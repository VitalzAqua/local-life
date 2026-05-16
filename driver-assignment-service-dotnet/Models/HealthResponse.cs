namespace LocalLife.DriverAssignment.Models;

public sealed class HealthResponse
{
    public string Status { get; init; } = "";
    public string Service { get; init; } = "";
    public DateTimeOffset Timestamp { get; init; }
    public HealthFeatures Features { get; init; } = new();
}

public sealed class HealthFeatures
{
    public bool MultiDelivery { get; init; }
    public bool RouteOptimization { get; init; }
    public int MaxEtaHours { get; init; }
}
