using LocalLife.DriverAssignment.Models;

namespace LocalLife.DriverAssignment.Services;

public sealed class DriverAssignmentAlgorithm
{
    private readonly AssignmentOptions _options;

    public DriverAssignmentAlgorithm(AssignmentOptions? options = null)
    {
        _options = options ?? new AssignmentOptions();
    }

    public double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadiusKm = 6371;
        var deltaLat = DegreesToRadians(lat2 - lat1);
        var deltaLon = DegreesToRadians(lon2 - lon1);

        var a =
            Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2) +
            Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
            Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusKm * c;
    }

    public double CalculateTravelTime(double lat1, double lon1, double lat2, double lon2, int? speedKmh = null)
    {
        var speed = speedKmh ?? _options.SpeedKmh;
        var distance = CalculateDistance(lat1, lon1, lat2, lon2);
        return (distance / speed) * 60;
    }

    public double CalculateEtaFromCurrentPosition(Location currentLocation, DeliverySnapshot newDelivery, int? speedKmh = null)
    {
        var currentLat = currentLocation.ResolveLatitude();
        var currentLng = currentLocation.ResolveLongitude();
        var pickupLat = newDelivery.RestaurantLocation.ResolveLatitude();
        var pickupLng = newDelivery.RestaurantLocation.ResolveLongitude();
        var dropoffLat = newDelivery.CustomerLocation.ResolveLatitude();
        var dropoffLng = newDelivery.CustomerLocation.ResolveLongitude();

        if (currentLat is null || currentLng is null || pickupLat is null || pickupLng is null || dropoffLat is null || dropoffLng is null)
        {
            return double.PositiveInfinity;
        }

        return CalculateTravelTime(currentLat.Value, currentLng.Value, pickupLat.Value, pickupLng.Value, speedKmh) +
               CalculateTravelTime(pickupLat.Value, pickupLng.Value, dropoffLat.Value, dropoffLng.Value, speedKmh);
    }

    public double CalculateRemainingEta(DriverSnapshot driver, DeliverySnapshot delivery)
    {
        if (driver.Latitude is null || driver.Longitude is null)
        {
            return double.PositiveInfinity;
        }

        if (!IsLocationValid(delivery.RestaurantLocation) || !IsLocationValid(delivery.CustomerLocation))
        {
            return double.PositiveInfinity;
        }

        return CalculateRemainingEta(
            new Location { Lat = driver.Latitude, Lng = driver.Longitude },
            delivery,
            driver.SpeedKmh);
    }

    public double CalculateRemainingEta(Location currentLocation, DeliverySnapshot delivery, int? speedKmh = null)
    {
        var currentLat = currentLocation.ResolveLatitude();
        var currentLng = currentLocation.ResolveLongitude();
        var pickupLat = delivery.RestaurantLocation.ResolveLatitude();
        var pickupLng = delivery.RestaurantLocation.ResolveLongitude();
        var dropoffLat = delivery.CustomerLocation.ResolveLatitude();
        var dropoffLng = delivery.CustomerLocation.ResolveLongitude();

        if (currentLat is null || currentLng is null || pickupLat is null || pickupLng is null || dropoffLat is null || dropoffLng is null)
        {
            return double.PositiveInfinity;
        }

        return delivery.Status switch
        {
            DeliveryStatus.Assigned or DeliveryStatus.Started =>
                CalculateTravelTime(currentLat.Value, currentLng.Value, pickupLat.Value, pickupLng.Value, speedKmh) +
                CalculateTravelTime(pickupLat.Value, pickupLng.Value, dropoffLat.Value, dropoffLng.Value, speedKmh),
            DeliveryStatus.ArrivedAtRestaurant =>
                CalculateTravelTime(currentLat.Value, currentLng.Value, dropoffLat.Value, dropoffLng.Value, speedKmh),
            DeliveryStatus.PickedUp =>
                CalculateTravelTime(currentLat.Value, currentLng.Value, dropoffLat.Value, dropoffLng.Value, speedKmh),
            DeliveryStatus.Returning => 0d,
            _ => 0d
        };
    }

    public DriverEtaEvaluation? FindBestDriverForOrder(IEnumerable<DriverSnapshot> drivers, DeliverySnapshot newDelivery)
    {
        DriverSnapshot? bestDriver = null;
        var shortestTime = double.PositiveInfinity;

        foreach (var driver in drivers)
        {
            if (driver.CurrentDeliveries.Count >= driver.MaxConcurrentOrders)
            {
                continue;
            }

            var totalEta = CalculateTotalEta(driver, newDelivery);
            if (!double.IsNaN(totalEta) && totalEta < shortestTime && totalEta <= _options.MaxEtaHours * 60)
            {
                shortestTime = totalEta;
                bestDriver = driver;
            }
        }

        if (bestDriver is null)
        {
            return null;
        }

        return new DriverEtaEvaluation
        {
            Driver = bestDriver,
            TotalEta = shortestTime
        };
    }

    public double CalculateTotalEta(DriverSnapshot driver, DeliverySnapshot newDelivery)
    {
        if (driver.Latitude is null || driver.Longitude is null)
        {
            return double.PositiveInfinity;
        }

        if (!IsLocationValid(newDelivery.RestaurantLocation) || !IsLocationValid(newDelivery.CustomerLocation))
        {
            return double.PositiveInfinity;
        }

        var currentLocation = new Location { Lat = driver.Latitude, Lng = driver.Longitude };
        var activeDeliveries = driver.CurrentDeliveries
            .Where(delivery => delivery.Status != DeliveryStatus.Completed && delivery.Status != DeliveryStatus.Cancelled)
            .OrderBy(delivery => delivery.RouteOrder)
            .ThenBy(delivery => delivery.OrderId)
            .ToList();

        if (activeDeliveries.Count == 0 || activeDeliveries.All(delivery => delivery.Status == DeliveryStatus.Returning))
        {
            return CalculateEtaFromCurrentPosition(currentLocation, newDelivery, driver.SpeedKmh);
        }

        var remainingActiveEta = 0d;
        var cursor = currentLocation;

        foreach (var delivery in activeDeliveries)
        {
            if (delivery.Status == DeliveryStatus.Returning)
            {
                continue;
            }

            remainingActiveEta += CalculateRemainingEta(cursor, delivery, driver.SpeedKmh);
            cursor = new Location
            {
                Lat = delivery.CustomerLocation.ResolveLatitude(),
                Lng = delivery.CustomerLocation.ResolveLongitude()
            };
        }

        return remainingActiveEta + CalculateEtaFromCurrentPosition(cursor, newDelivery, driver.SpeedKmh);
    }

    private static bool IsLocationValid(Location? location)
    {
        return location?.ResolveLatitude() is not null && location.ResolveLongitude() is not null;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180d;
    }
}
