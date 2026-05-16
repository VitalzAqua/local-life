namespace LocalLife.DriverAssignment.Models;

public sealed class DriverSnapshot
{
    public int DriverId { get; init; }
    public string DriverName { get; init; } = "";
    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public int? SpeedKmh { get; init; }
    public int MaxConcurrentOrders { get; init; } = 3;
    public IReadOnlyList<DeliverySnapshot> CurrentDeliveries { get; init; } = [];
}
