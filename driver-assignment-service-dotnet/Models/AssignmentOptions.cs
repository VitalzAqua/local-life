namespace LocalLife.DriverAssignment.Models;

public sealed class AssignmentOptions
{
    public int MaxEtaHours { get; init; } = 2;
    public int SpeedKmh { get; init; } = 40;
    public int StopTimeMinutes { get; init; } = 8;
    public int PreparationTimeMinutes { get; init; } = 5;
}
