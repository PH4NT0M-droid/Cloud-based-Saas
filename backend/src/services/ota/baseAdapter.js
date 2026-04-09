class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  async mockApiResponse(payload, delayMs = 60) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return payload;
  }

  async syncInventory(data) {
    throw new Error(`${this.name}: syncInventory() must be implemented`);
  }

  async syncRates(data) {
    throw new Error(`${this.name}: syncRates() must be implemented`);
  }

  async fetchBookings() {
    throw new Error(`${this.name}: fetchBookings() must be implemented`);
  }
}

module.exports = BaseAdapter;
