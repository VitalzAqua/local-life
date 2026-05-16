using LocalLife.DriverAssignment.Models;
using Microsoft.AspNetCore.Mvc;

namespace LocalLife.DriverAssignment.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public HealthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet]
    public ActionResult<HealthResponse> Get()
    {
        var maxEtaHours = _configuration.GetValue<int>("Assignment:MaxEtaHours");

        return Ok(new HealthResponse
        {
            Status = "healthy",
            Service = "driver-assignment-service-dotnet",
            Timestamp = DateTimeOffset.UtcNow,
            Features = new HealthFeatures
            {
                MultiDelivery = true,
                RouteOptimization = true,
                MaxEtaHours = maxEtaHours
            }
        });
    }
}
