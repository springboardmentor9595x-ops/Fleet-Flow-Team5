import api from './axios';

export function getFuelRecords(params = {}) {
  return api.get('/fuel-records/', { params });
}

export function getFuelStatsAndTrends() {
  return api.get('/fuel-records/stats/trends');
}

export function createFuelRecord(data) {
  return api.post('/fuel-records/', data);
}
