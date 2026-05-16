using LocalLife.DriverAssignment.Models;
using LocalLife.DriverAssignment.Services;
using Xunit;

namespace LocalLife.DriverAssignment.Tests;

public sealed class DriverAssignmentAlgorithmTests
{
    private readonly DriverAssignmentAlgorithm _algorithm = new();

    [Fact]
    public void CalculateEtaFromCurrentPosition_UsesCurrentToPickupToDropoff()
    {
        var eta = _algorithm.CalculateEtaFromCurrentPosition(
            new Location { Lat = 43.6500, Lng = -79.3800 },
            CreateDelivery(101, DeliveryStatus.Assigned, 1, 43.6510, -79.3810, 43.6520, -79.3820),
            40);

        Assert.True(eta > 0);
    }

    [Fact]
    public void CalculateTotalEta_ForReturningDriver_UsesCurrentPositionDirectly()
    {
        var driver = new DriverSnapshot
        {
            DriverName = "Returning Driver",
            Latitude = 43.6500,
            Longitude = -79.3800,
            SpeedKmh = 40,
            CurrentDeliveries =
            [
                CreateDelivery(1, DeliveryStatus.Returning, 1, 43.6400, -79.3700, 43.6450, -79.3750)
            ]
        };
        var newDelivery = CreateDelivery(2, DeliveryStatus.Assigned, 1, 43.6510, -79.3810, 43.6520, -79.3820);

        var totalEta = _algorithm.CalculateTotalEta(driver, newDelivery);
        var directEta = _algorithm.CalculateEtaFromCurrentPosition(
            new Location { Lat = driver.Latitude, Lng = driver.Longitude },
            newDelivery,
            driver.SpeedKmh);

        Assert.Equal(directEta, totalEta, 6);
    }

    [Fact]
    public void CalculateRemainingEta_ForStartedDelivery_UsesCurrentToRestaurantToCustomer()
    {
        var driver = new DriverSnapshot
        {
            DriverName = "Started Driver",
            Latitude = 43.6500,
            Longitude = -79.3800,
            SpeedKmh = 40
        };

        var delivery = CreateDelivery(10, DeliveryStatus.Started, 1, 43.6510, -79.3810, 43.6520, -79.3820);

        var eta = _algorithm.CalculateRemainingEta(driver, delivery);
        var expected = _algorithm.CalculateTravelTime(43.6500, -79.3800, 43.6510, -79.3810, 40) +
                       _algorithm.CalculateTravelTime(43.6510, -79.3810, 43.6520, -79.3820, 40);

        Assert.Equal(expected, eta, 6);
    }

    [Fact]
    public void CalculateRemainingEta_ForArrivedAtRestaurant_UsesRestaurantToCustomer()
    {
        var delivery = CreateDelivery(10, DeliveryStatus.ArrivedAtRestaurant, 1, 43.6510, -79.3810, 43.6520, -79.3820);

        var eta = _algorithm.CalculateRemainingEta(
            new Location { Lat = 43.6510, Lng = -79.3810 },
            delivery,
            40);
        var expected = _algorithm.CalculateTravelTime(43.6510, -79.3810, 43.6520, -79.3820, 40);

        Assert.Equal(expected, eta, 6);
    }

    [Fact]
    public void CalculateRemainingEta_ForPickedUp_UsesCurrentToCustomer()
    {
        var delivery = CreateDelivery(10, DeliveryStatus.PickedUp, 1, 43.6510, -79.3810, 43.6520, -79.3820);

        var eta = _algorithm.CalculateRemainingEta(
            new Location { Lat = 43.6515, Lng = -79.3815 },
            delivery,
            40);
        var expected = _algorithm.CalculateTravelTime(43.6515, -79.3815, 43.6520, -79.3820, 40);

        Assert.Equal(expected, eta, 6);
    }

    [Fact]
    public void CalculateTotalEta_WithTwoActiveDeliveries_SumsRemainingWorkInRouteOrder()
    {
        var driver = new DriverSnapshot
        {
            DriverName = "Busy Driver",
            Latitude = 43.6500,
            Longitude = -79.3800,
            SpeedKmh = 40,
            CurrentDeliveries =
            [
                CreateDelivery(1, DeliveryStatus.Started, 1, 43.6510, -79.3810, 43.6520, -79.3820),
                CreateDelivery(2, DeliveryStatus.Assigned, 2, 43.6530, -79.3830, 43.6540, -79.3840)
            ]
        };
        var newDelivery = CreateDelivery(3, DeliveryStatus.Assigned, 3, 43.6550, -79.3850, 43.6560, -79.3860);

        var totalEta = _algorithm.CalculateTotalEta(driver, newDelivery);

        var firstEta = _algorithm.CalculateTravelTime(43.6500, -79.3800, 43.6510, -79.3810, 40) +
                       _algorithm.CalculateTravelTime(43.6510, -79.3810, 43.6520, -79.3820, 40);
        var secondEta = _algorithm.CalculateTravelTime(43.6520, -79.3820, 43.6530, -79.3830, 40) +
                        _algorithm.CalculateTravelTime(43.6530, -79.3830, 43.6540, -79.3840, 40);
        var thirdEta = _algorithm.CalculateTravelTime(43.6540, -79.3840, 43.6550, -79.3850, 40) +
                       _algorithm.CalculateTravelTime(43.6550, -79.3850, 43.6560, -79.3860, 40);

        Assert.Equal(firstEta + secondEta + thirdEta, totalEta, 6);
    }

    [Fact]
    public void FindBestDriverForOrder_SkipsDriverAtCapacityThree()
    {
        var newDelivery = CreateDelivery(10, DeliveryStatus.Assigned, 1, 43.6505, -79.3805, 43.6510, -79.3810);

        var result = _algorithm.FindBestDriverForOrder(
            [
                new DriverSnapshot
                {
                    DriverName = "Full Driver",
                    Latitude = 43.6502,
                    Longitude = -79.3802,
                    SpeedKmh = 40,
                    MaxConcurrentOrders = 3,
                    CurrentDeliveries =
                    [
                        CreateDelivery(1, DeliveryStatus.Started, 1, 43.6510, -79.3810, 43.6520, -79.3820),
                        CreateDelivery(2, DeliveryStatus.Assigned, 2, 43.6530, -79.3830, 43.6540, -79.3840),
                        CreateDelivery(3, DeliveryStatus.Assigned, 3, 43.6550, -79.3850, 43.6560, -79.3860)
                    ]
                },
                new DriverSnapshot
                {
                    DriverName = "Available Driver",
                    Latitude = 43.6600,
                    Longitude = -79.3900,
                    SpeedKmh = 40,
                    CurrentDeliveries = []
                }
            ],
            newDelivery);

        Assert.NotNull(result);
        Assert.Equal("Available Driver", result!.Driver.DriverName);
    }

    [Fact]
    public void FindBestDriverForOrder_PicksLowestEtaEligibleDriver()
    {
        var newDelivery = CreateDelivery(404, DeliveryStatus.Assigned, 1, 43.6505, -79.3805, 43.6510, -79.3790);

        var result = _algorithm.FindBestDriverForOrder(
            [
                new DriverSnapshot
                {
                    DriverName = "Far Driver",
                    Latitude = 43.7000,
                    Longitude = -79.4500,
                    SpeedKmh = 40,
                    CurrentDeliveries = []
                },
                new DriverSnapshot
                {
                    DriverName = "Near Driver",
                    Latitude = 43.6502,
                    Longitude = -79.3802,
                    SpeedKmh = 40,
                    CurrentDeliveries = []
                }
            ],
            newDelivery);

        Assert.NotNull(result);
        Assert.Equal("Near Driver", result!.Driver.DriverName);
        Assert.True(result.TotalEta > 0);
    }

    private static DeliverySnapshot CreateDelivery(
        int orderId,
        string status,
        int routeOrder,
        double restaurantLat,
        double restaurantLng,
        double customerLat,
        double customerLng)
    {
        return new DeliverySnapshot
        {
            OrderId = orderId,
            Status = status,
            RouteOrder = routeOrder,
            RestaurantLocation = new Location { Lat = restaurantLat, Lng = restaurantLng },
            CustomerLocation = new Location { Lat = customerLat, Lng = customerLng }
        };
    }
}
