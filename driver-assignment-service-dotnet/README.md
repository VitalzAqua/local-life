# LocalLife Driver Assignment Service (.NET)

This is the first migration slice from the existing Node.js driver assignment service to ASP.NET Core.

For now, this service exposes:

```http
GET /health
POST /assign
```

`POST /assign` now loads real online drivers and active deliveries from PostgreSQL, runs the simplified ETA scorer, and returns the best candidate. It still does not persist the assignment yet.

It intentionally runs beside the current Node service instead of replacing it.

## Run Locally

```bash
dotnet run --project driver-assignment-service-dotnet
```

Then open:

```text
http://localhost:5002/health
```


## What To Notice

- `Program.cs` is the ASP.NET Core startup file. It plays a similar role to Express `server.js`.
- `AddControllers()` registers controller-based HTTP endpoints.
- `MapControllers()` tells ASP.NET Core to use route attributes like `[Route]` and `[HttpGet]`.
- `Models/HealthResponse.cs` defines the C# object shape that ASP.NET Core serializes into JSON.
- `Models/AssignmentRequest.cs` and `Models/AssignmentResponse.cs` define the typed `/assign` contract.
- `Services/DriverAssignmentAlgorithm.cs` ports the pure sequencing and ETA logic from the Node service into testable C# code.
- `appsettings.json` stores configuration, including the local URL and assignment defaults.
- The repo-level `global.json` pins .NET CLI commands to the .NET 8 SDK family.
