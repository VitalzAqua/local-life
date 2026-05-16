using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Services;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;

namespace LocalLife.DriverAssignment.Controllers;

[ApiController]
[Route("assign")]
public sealed class AssignmentController : ControllerBase
{
    private readonly IDriverAssignmentSelector _driverAssignmentSelector;

    public AssignmentController(IDriverAssignmentSelector driverAssignmentSelector)
    {
        _driverAssignmentSelector = driverAssignmentSelector;
    }

    [HttpPost]
    public async Task<ActionResult<AssignmentResponse>> Assign([FromBody] AssignmentRequest request, CancellationToken cancellationToken)
    {
        if (request.OrderId is null || request.StoreLocation is null)
        {
            return BadRequest(new AssignmentResponse
            {
                Success = false,
                Message = "orderId and storeLocation are required"
            });
        }

        if (request.StoreLocation.ResolveLatitude() is null ||
            request.StoreLocation.ResolveLongitude() is null)
        {
            return BadRequest(new AssignmentResponse
            {
                Success = false,
                Message = "storeLocation must include lat and lng"
            });
        }

        var selectedDriver = await _driverAssignmentSelector.SelectBestDriverAsync(request, cancellationToken);
        if (selectedDriver is null)
        {
            return NotFound(new AssignmentResponse
            {
                Success = false,
                Message = "No available drivers within 2-hour delivery window",
                Sequence = null,
                Optimized = false
            });
        }

        return Ok(new AssignmentResponse
        {
            Success = true,
            Message = $"Assigned to {selectedDriver.Driver.DriverName} ({(selectedDriver.TotalEta / 60d).ToString("0.0", CultureInfo.InvariantCulture)}h total ETA)",
            Driver = new AssignedDriverInfo
            {
                DriverId = selectedDriver.Driver.DriverId,
                Name = selectedDriver.Driver.DriverName,
                DriverName = selectedDriver.Driver.DriverName,
                CurrentLat = selectedDriver.Driver.Latitude,
                CurrentLng = selectedDriver.Driver.Longitude,
                SpeedKmh = selectedDriver.Driver.SpeedKmh,
                MaxConcurrentOrders = selectedDriver.Driver.MaxConcurrentOrders
            },
            TotalEta = (int)Math.Ceiling(selectedDriver.TotalEta),
            TotalEtaHours = (selectedDriver.TotalEta / 60d).ToString("0.0", CultureInfo.InvariantCulture),
            Sequence = null,
            Optimized = false
        });
    }
}
