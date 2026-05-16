using LocalLife.DriverAssignment.Controllers;
using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Services;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace LocalLife.DriverAssignment.Tests;

public sealed class AssignmentControllerTests
{
    [Fact]
    public async Task Assign_ReturnsBadRequest_WhenOrderIdOrStoreLocationIsMissing()
    {
        var controller = new AssignmentController(new StubDriverAssignmentSelector(null));

        var result = await controller.Assign(new AssignmentRequest
        {
            OrderId = null,
            StoreLocation = null
        }, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<AssignmentResponse>(badRequest.Value);
        Assert.False(response.Success);
        Assert.Equal("orderId and storeLocation are required", response.Message);
    }

    [Fact]
    public async Task Assign_ReturnsBadRequest_WhenStoreLocationCoordinatesAreMissing()
    {
        var controller = new AssignmentController(new StubDriverAssignmentSelector(null));

        var result = await controller.Assign(new AssignmentRequest
        {
            OrderId = 42,
            StoreLocation = new Location()
        }, CancellationToken.None);

        var badRequest = Assert.IsType<BadRequestObjectResult>(result.Result);
        var response = Assert.IsType<AssignmentResponse>(badRequest.Value);
        Assert.False(response.Success);
        Assert.Equal("storeLocation must include lat and lng", response.Message);
    }

    [Fact]
    public async Task Assign_ReturnsNotFound_WhenNoDriverCanBeSelected()
    {
        var controller = new AssignmentController(new StubDriverAssignmentSelector(null));

        var result = await controller.Assign(new AssignmentRequest
        {
            OrderId = 42,
            StoreLocation = new Location { Lat = 43.6500, Lng = -79.3800 }
        }, CancellationToken.None);

        var notFound = Assert.IsType<NotFoundObjectResult>(result.Result);
        var response = Assert.IsType<AssignmentResponse>(notFound.Value);
        Assert.False(response.Success);
        Assert.Equal("No available drivers within 2-hour delivery window", response.Message);
    }

    private sealed class StubDriverAssignmentSelector : IDriverAssignmentSelector
    {
        private readonly DriverEtaEvaluation? _result;

        public StubDriverAssignmentSelector(DriverEtaEvaluation? result)
        {
            _result = result;
        }

        public Task<DriverEtaEvaluation?> SelectBestDriverAsync(AssignmentRequest request, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_result);
        }
    }
}
