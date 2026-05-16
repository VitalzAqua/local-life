using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Repositories;

namespace LocalLife.DriverAssignment.Services;

public sealed class DriverAssignmentSelector : IDriverAssignmentSelector
{
    private readonly DriverAssignmentAlgorithm _algorithm;
    private readonly IDriverSnapshotRepository _driverSnapshotRepository;

    public DriverAssignmentSelector(
        DriverAssignmentAlgorithm algorithm,
        IDriverSnapshotRepository driverSnapshotRepository)
    {
        _algorithm = algorithm;
        _driverSnapshotRepository = driverSnapshotRepository;
    }

    public async Task<DriverEtaEvaluation?> SelectBestDriverAsync(
        AssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.OrderId is null || request.StoreLocation is null)
        {
            return null;
        }

        var newDelivery = new DeliverySnapshot
        {
            OrderId = request.OrderId.Value,
            RestaurantLocation = request.StoreLocation,
            CustomerLocation = request.CustomerLocation ?? new Location(),
            Status = DeliveryStatus.Assigned,
            RouteOrder = 1
        };

        var drivers = await _driverSnapshotRepository.GetOnlineDriversAsync(cancellationToken);
        var selectedDriver = _algorithm.FindBestDriverForOrder(drivers, newDelivery);
        if (selectedDriver is null)
        {
            return null;
        }

        await _driverSnapshotRepository.PersistAssignmentAsync(
            selectedDriver.Driver,
            request,
            (int)Math.Ceiling(selectedDriver.TotalEta),
            cancellationToken);

        return selectedDriver;
    }
}
