using System.Text.Json.Serialization;

namespace LocalLife.DriverAssignment.Models;

public sealed class AssignedDriverInfo
{
    [JsonPropertyName("driver_id")]
    public int DriverId { get; init; }

    public string Name { get; init; } = "";

    [JsonPropertyName("driver_name")]
    public string DriverName { get; init; } = "";

    [JsonPropertyName("current_lat")]
    public double? CurrentLat { get; init; }

    [JsonPropertyName("current_lng")]
    public double? CurrentLng { get; init; }

    [JsonPropertyName("speed_kmh")]
    public int? SpeedKmh { get; init; }

    [JsonPropertyName("max_concurrent_orders")]
    public int MaxConcurrentOrders { get; init; }
}
