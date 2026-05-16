namespace LocalLife.DriverAssignment.Models;

public sealed class AssignmentRequest
{
    public int? OrderId { get; init; }
    public Location? StoreLocation { get; init; }
    public Location? CustomerLocation { get; init; }
}
