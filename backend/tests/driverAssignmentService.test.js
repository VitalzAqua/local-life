jest.mock('../../driver-assignment-service/database', () => ({
  query: jest.fn(),
  connect: jest.fn()
}));

const driverAssignmentService = require('../../driver-assignment-service/driverAssignmentService');

describe('driver assignment sequencing', () => {
  test('generates only valid pickup-before-dropoff sequences for multiple deliveries', () => {
    const sequences = driverAssignmentService.generateDeliverySequences([
      {
        order_id: 101,
        restaurant_location: { lat: 43.6501, lng: -79.3801 },
        customer_location: { lat: 43.6601, lng: -79.3701 }
      },
      {
        order_id: 202,
        restaurant_location: { lat: 43.651, lng: -79.381 },
        customer_location: { lat: 43.661, lng: -79.371 }
      }
    ]);

    expect(sequences).toHaveLength(6);

    for (const sequence of sequences) {
      const pickupIndexByOrder = new Map();
      const dropoffIndexByOrder = new Map();

      sequence.forEach((stop, index) => {
        if (stop.type === 'pickup') {
          pickupIndexByOrder.set(stop.delivery.order_id, index);
        }
        if (stop.type === 'dropoff') {
          dropoffIndexByOrder.set(stop.delivery.order_id, index);
        }
      });

      expect(pickupIndexByOrder.get(101)).toBeLessThan(dropoffIndexByOrder.get(101));
      expect(pickupIndexByOrder.get(202)).toBeLessThan(dropoffIndexByOrder.get(202));
    }
  });

  test('marks a driver as invalid when the current coordinates are missing', () => {
    const result = driverAssignmentService.findOptimalSequence(
      {
        driver_name: 'Driver A',
        latitude: null,
        longitude: -79.38,
        current_deliveries: [],
        speed_kmh: 40
      },
      {
        order_id: 303,
        restaurant_location: { lat: 43.65, lng: -79.38 },
        customer_location: { lat: 43.66, lng: -79.37 }
      }
    );

    expect(result).toEqual({
      sequence: null,
      totalETA: Infinity,
      isValid: false
    });
  });
});
