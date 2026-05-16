using LocalLife.DriverAssignment.Models;

namespace LocalLife.DriverAssignment.Repositories;

public interface IDriverSnapshotRepository
{
    Task<IReadOnlyList<DriverSnapshot>> GetOnlineDriversAsync(CancellationToken cancellationToken = default);
    Task<int> PersistAssignmentAsync(
        DriverSnapshot driver,
        AssignmentRequest request,
        int totalEtaMinutes,
        CancellationToken cancellationToken = default);
}
