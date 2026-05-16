using System.Text.Json.Serialization;

namespace LocalLife.DriverAssignment.Models;

public sealed class AssignmentResponse
{
    public bool Success { get; init; }
    public string Message { get; init; } = "";
    public object? Driver { get; init; }

    [JsonPropertyName("totalETA")]
    public int? TotalEta { get; init; }

    [JsonPropertyName("totalETAHours")]
    public string? TotalEtaHours { get; init; }

    public object? Sequence { get; init; }
    public bool? Optimized { get; init; }
}
