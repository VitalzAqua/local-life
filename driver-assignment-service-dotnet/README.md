# LocalLife Driver Assignment Service (.NET)

This is the first migration slice from the existing Node.js driver assignment service to ASP.NET Core.

For now, this service exposes:

```http
GET /health
POST /assign
```

`POST /assign` now loads real online drivers and active deliveries from PostgreSQL, runs the simplified ETA scorer, persists the assignment, and returns the selected driver payload.

It intentionally runs beside the current Node service instead of replacing it.

## Run Locally

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:5002 dotnet run --project driver-assignment-service-dotnet
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
- `Repositories/PostgresDriverSnapshotRepository.cs` handles PostgreSQL reads/writes for driver assignment.
- `appsettings.json` stores safe application defaults such as assignment settings.
- The repo-level `global.json` pins .NET CLI commands to the .NET 8 SDK family.

## Render Notes

- Render web services provide a `PORT` environment variable and expect your app to listen on `0.0.0.0`.
- `Program.cs` now binds to `PORT` automatically when it is present.
- The Docker image no longer hardcodes port `5002`, so the same image works locally and on Render.
