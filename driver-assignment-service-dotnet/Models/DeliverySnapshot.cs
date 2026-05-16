namespace LocalLife.DriverAssignment.Models;

public sealed class DeliverySnapshot
{
    public int OrderId { get; init; }
    public Location RestaurantLocation { get; init; } = new();
    public Location CustomerLocation { get; init; } = new();
    public int? DeliveryId { get; init; }
    public string Status { get; init; } = DeliveryStatus.Assigned;
    public int RouteOrder { get; init; } = 1;
}
