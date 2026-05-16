using System.Text.Json;
using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Repositories;
using LocalLife.DriverAssignment.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Match the camelCase JSON style that the current Node service returns.
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

var assignmentOptions = builder.Configuration.GetSection("Assignment").Get<AssignmentOptions>() ?? new AssignmentOptions();
builder.Services.AddSingleton(new DriverAssignmentAlgorithm(assignmentOptions));
builder.Services.AddScoped<IDriverSnapshotRepository, PostgresDriverSnapshotRepository>();
builder.Services.AddScoped<IDriverAssignmentSelector, DriverAssignmentSelector>();

var app = builder.Build();

app.MapControllers();

app.Run();
