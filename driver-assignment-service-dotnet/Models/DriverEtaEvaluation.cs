namespace LocalLife.DriverAssignment.Models;

public sealed class DriverEtaEvaluation
{
    public DriverSnapshot Driver { get; init; } = new();
    public double TotalEta { get; init; }
}
