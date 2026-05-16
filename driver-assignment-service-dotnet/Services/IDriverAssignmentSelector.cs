using LocalLife.DriverAssignment.Models;

namespace LocalLife.DriverAssignment.Services;

public interface IDriverAssignmentSelector
{
    Task<DriverEtaEvaluation?> SelectBestDriverAsync(AssignmentRequest request, CancellationToken cancellationToken = default);
}
