namespace LocalLife.DriverAssignment.Models;

public sealed class Location
{
    public double? Lat { get; init; }
    public double? Lng { get; init; }
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }

    public double? ResolveLatitude()
    {
        return Lat ?? Latitude;
    }

    public double? ResolveLongitude()
    {
        return Lng ?? Longitude;
    }
}
