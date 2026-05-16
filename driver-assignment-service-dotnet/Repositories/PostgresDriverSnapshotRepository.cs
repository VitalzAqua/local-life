using System.Text.Json;
using System.Globalization;
using LocalLife.DriverAssignment.Models;
using Npgsql;

namespace LocalLife.DriverAssignment.Repositories;

public sealed class PostgresDriverSnapshotRepository : IDriverSnapshotRepository
{
    private readonly string _connectionString;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public PostgresDriverSnapshotRepository(IConfiguration configuration)
    {
        var databaseUrl = configuration["DATABASE_URL"];
        if (string.IsNullOrWhiteSpace(databaseUrl))
        {
            throw new InvalidOperationException("DATABASE_URL environment variable is required");
        }

        _connectionString = BuildConnectionString(databaseUrl, configuration["DB_SSL"]);
    }

    public async Task<IReadOnlyList<DriverSnapshot>> GetOnlineDriversAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
              d.id AS driver_id,
              d.name AS driver_name,
              d.current_lat,
              d.current_lng,
              d.speed_kmh,
              d.max_concurrent_orders,
              del.id AS delivery_id,
              del.order_id,
              del.status,
              del.route_order,
              del.restaurant_location,
              del.customer_location
            FROM drivers d
            LEFT JOIN deliveries del
              ON d.id = del.driver_id
             AND del.status NOT IN ('completed', 'cancelled')
            WHERE d.is_online = true
            ORDER BY d.id, del.route_order, del.id
            """;

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var drivers = new Dictionary<int, DriverAccumulator>();

        while (await reader.ReadAsync(cancellationToken))
        {
            var driverId = reader.GetInt32(reader.GetOrdinal("driver_id"));
            if (!drivers.TryGetValue(driverId, out var driver))
            {
                driver = new DriverAccumulator
                {
                    DriverId = driverId,
                    DriverName = reader.GetString(reader.GetOrdinal("driver_name")),
                    Latitude = ReadNullableDouble(reader, "current_lat"),
                    Longitude = ReadNullableDouble(reader, "current_lng"),
                    SpeedKmh = ReadNullableInt(reader, "speed_kmh"),
                    MaxConcurrentOrders = ReadNullableInt(reader, "max_concurrent_orders") ?? 3
                };

                drivers[driverId] = driver;
            }

            if (!reader.IsDBNull(reader.GetOrdinal("delivery_id")))
            {
                driver.CurrentDeliveries.Add(new DeliverySnapshot
                {
                    DeliveryId = reader.GetInt32(reader.GetOrdinal("delivery_id")),
                    OrderId = reader.GetInt32(reader.GetOrdinal("order_id")),
                    Status = reader.GetString(reader.GetOrdinal("status")),
                    RouteOrder = ReadNullableInt(reader, "route_order") ?? 1,
                    RestaurantLocation = ReadLocation(reader, "restaurant_location"),
                    CustomerLocation = ReadLocation(reader, "customer_location")
                });
            }
        }

        return drivers.Values
            .Select(driver => new DriverSnapshot
            {
                DriverId = driver.DriverId,
                DriverName = driver.DriverName,
                Latitude = driver.Latitude,
                Longitude = driver.Longitude,
                SpeedKmh = driver.SpeedKmh,
                MaxConcurrentOrders = driver.MaxConcurrentOrders,
                CurrentDeliveries = driver.CurrentDeliveries
                    .OrderBy(delivery => delivery.RouteOrder)
                    .ThenBy(delivery => delivery.OrderId)
                    .ToList()
            })
            .ToList();
    }

    private static string BuildConnectionString(string connectionString, string? dbSslSetting)
    {
        var builder = TryBuildFromPostgresUrl(connectionString) ??
            new NpgsqlConnectionStringBuilder(connectionString);

        if (string.Equals(dbSslSetting, "true", StringComparison.OrdinalIgnoreCase))
        {
            builder.SslMode = SslMode.Require;
            return builder.ConnectionString;
        }

        if (string.Equals(dbSslSetting, "false", StringComparison.OrdinalIgnoreCase))
        {
            builder.SslMode = SslMode.Disable;
            return builder.ConnectionString;
        }

        try
        {
            var hostname = new Uri(connectionString).Host;
            if (hostname is "localhost" or "127.0.0.1" or "db" or "postgres")
            {
                builder.SslMode = SslMode.Disable;
                return builder.ConnectionString;
            }
        }
        catch (UriFormatException)
        {
            builder.SslMode = SslMode.Disable;
            return builder.ConnectionString;
        }

        builder.SslMode = SslMode.Require;
        return builder.ConnectionString;
    }

    private static NpgsqlConnectionStringBuilder? TryBuildFromPostgresUrl(string connectionString)
    {
        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri))
        {
            return null;
        }

        if (!string.Equals(uri.Scheme, "postgres", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, "postgresql", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Database = uri.AbsolutePath.Trim('/'),
            Username = Uri.UnescapeDataString(uri.UserInfo.Split(':', 2)[0])
        };

        if (uri.Port > 0)
        {
            builder.Port = uri.Port;
        }

        var password = uri.UserInfo.Split(':', 2).Skip(1).FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(password))
        {
            builder.Password = Uri.UnescapeDataString(password);
        }

        return builder;
    }

    public async Task<int> PersistAssignmentAsync(
        DriverSnapshot driver,
        AssignmentRequest request,
        int totalEtaMinutes,
        CancellationToken cancellationToken = default)
    {
        if (request.OrderId is null || request.StoreLocation is null)
        {
            throw new InvalidOperationException("orderId and storeLocation are required");
        }

        await using var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var nextRouteOrder = await GetNextRouteOrderAsync(connection, transaction, driver.DriverId, cancellationToken);
            var customerLocation = request.CustomerLocation ?? new Location();

            const string insertDeliverySql = """
                INSERT INTO deliveries (
                  order_id,
                  driver_id,
                  status,
                  restaurant_location,
                  customer_location,
                  assigned_at,
                  estimated_delivery_time,
                  route_order
                )
                VALUES ($1, $2, 'assigned', $3::jsonb, $4::jsonb, NOW(), $5, $6)
                RETURNING id
                """;

            var restaurantJson = JsonSerializer.Serialize(request.StoreLocation, _jsonOptions);
            var customerJson = JsonSerializer.Serialize(customerLocation, _jsonOptions);

            await using var insertDelivery = new NpgsqlCommand(insertDeliverySql, connection, transaction);
            insertDelivery.Parameters.AddWithValue(request.OrderId.Value);
            insertDelivery.Parameters.AddWithValue(driver.DriverId);
            insertDelivery.Parameters.AddWithValue(restaurantJson);
            insertDelivery.Parameters.AddWithValue(customerJson);
            insertDelivery.Parameters.AddWithValue(totalEtaMinutes);
            insertDelivery.Parameters.AddWithValue(nextRouteOrder);

            var deliveryId = Convert.ToInt32(await insertDelivery.ExecuteScalarAsync(cancellationToken), CultureInfo.InvariantCulture);

            const string updateOrderSql = """
                UPDATE orders
                SET status = 'assigned', updated_at = NOW()
                WHERE id = $1
                """;

            await using var updateOrder = new NpgsqlCommand(updateOrderSql, connection, transaction);
            updateOrder.Parameters.AddWithValue(request.OrderId.Value);
            var updatedOrders = await updateOrder.ExecuteNonQueryAsync(cancellationToken);
            if (updatedOrders == 0)
            {
                throw new InvalidOperationException($"Order {request.OrderId.Value} was not found");
            }

            const string updateDriverSql = """
                UPDATE drivers
                SET is_available = false, updated_at = NOW()
                WHERE id = $1
                """;

            await using var updateDriver = new NpgsqlCommand(updateDriverSql, connection, transaction);
            updateDriver.Parameters.AddWithValue(driver.DriverId);
            var updatedDrivers = await updateDriver.ExecuteNonQueryAsync(cancellationToken);
            if (updatedDrivers == 0)
            {
                throw new InvalidOperationException($"Driver {driver.DriverId} was not found");
            }

            await transaction.CommitAsync(cancellationToken);
            return deliveryId;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static async Task<int> GetNextRouteOrderAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        int driverId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COALESCE(MAX(route_order), 0) + 1
            FROM deliveries
            WHERE driver_id = $1
              AND status NOT IN ('completed', 'cancelled')
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue(driverId);
        return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken), CultureInfo.InvariantCulture);
    }

    private Location ReadLocation(NpgsqlDataReader reader, string columnName)
    {
        if (reader.IsDBNull(reader.GetOrdinal(columnName)))
        {
            return new Location();
        }

        var json = reader.GetString(reader.GetOrdinal(columnName));
        return JsonSerializer.Deserialize<Location>(json, _jsonOptions) ?? new Location();
    }

    private static double? ReadNullableDouble(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToDouble(reader.GetValue(ordinal), CultureInfo.InvariantCulture);
    }

    private static int? ReadNullableInt(NpgsqlDataReader reader, string columnName)
    {
        var ordinal = reader.GetOrdinal(columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToInt32(reader.GetValue(ordinal), CultureInfo.InvariantCulture);
    }

    private sealed class DriverAccumulator
    {
        public int DriverId { get; init; }
        public string DriverName { get; init; } = "";
        public double? Latitude { get; init; }
        public double? Longitude { get; init; }
        public int? SpeedKmh { get; init; }
        public int MaxConcurrentOrders { get; init; }
        public List<DeliverySnapshot> CurrentDeliveries { get; } = [];
    }
}
