using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Repositories;
using LocalLife.DriverAssignment.Services;
using Xunit;

namespace LocalLife.DriverAssignment.Tests;

public sealed class DriverAssignmentSelectorTests
{
    [Fact]
    public async Task SelectBestDriverAsync_PersistsAssignment_WhenDriverIsSelected()
    {
        var repository = new FakeDriverSnapshotRepository
        {
            Drivers =
            [
                new DriverSnapshot
                {
                    DriverId = 7,
                    DriverName = "Closest Driver",
                    Latitude = 43.6502,
                    Longitude = -79.3802,
                    SpeedKmh = 40,
                    CurrentDeliveries = []
                }
            ]
        };

        var selector = new DriverAssignmentSelector(new DriverAssignmentAlgorithm(), repository);
        var request = new AssignmentRequest
        {
            OrderId = 12,
            StoreLocation = new Location { Lat = 43.6505, Lng = -79.3805 },
            CustomerLocation = new Location { Lat = 43.6510, Lng = -79.3790 }
        };

        var result = await selector.SelectBestDriverAsync(request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.True(repository.PersistWasCalled);
        Assert.Equal(7, repository.PersistedDriverId);
        Assert.Equal(12, repository.PersistedOrderId);
        Assert.True(repository.PersistedEtaMinutes > 0);
    }

    [Fact]
    public async Task SelectBestDriverAsync_DoesNotPersist_WhenNoDriverIsSelected()
    {
        var repository = new FakeDriverSnapshotRepository
        {
            Drivers = []
        };

        var selector = new DriverAssignmentSelector(new DriverAssignmentAlgorithm(), repository);
        var request = new AssignmentRequest
        {
            OrderId = 12,
            StoreLocation = new Location { Lat = 43.6505, Lng = -79.3805 },
            CustomerLocation = new Location { Lat = 43.6510, Lng = -79.3790 }
        };

        var result = await selector.SelectBestDriverAsync(request, CancellationToken.None);

        Assert.Null(result);
        Assert.False(repository.PersistWasCalled);
    }

    private sealed class FakeDriverSnapshotRepository : IDriverSnapshotRepository
    {
        public IReadOnlyList<DriverSnapshot> Drivers { get; init; } = [];
        public bool PersistWasCalled { get; private set; }
        public int? PersistedDriverId { get; private set; }
        public int? PersistedOrderId { get; private set; }
        public int PersistedEtaMinutes { get; private set; }

        public Task<IReadOnlyList<DriverSnapshot>> GetOnlineDriversAsync(CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Drivers);
        }

        public Task<int> PersistAssignmentAsync(
            DriverSnapshot driver,
            AssignmentRequest request,
            int totalEtaMinutes,
            CancellationToken cancellationToken = default)
        {
            PersistWasCalled = true;
            PersistedDriverId = driver.DriverId;
            PersistedOrderId = request.OrderId;
            PersistedEtaMinutes = totalEtaMinutes;
            return Task.FromResult(99);
        }
    }
}
