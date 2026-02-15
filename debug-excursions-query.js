
const localStartOfToday = new Date();
localStartOfToday.setHours(0, 0, 0, 0);
const cutoff = localStartOfToday.toISOString();

console.log('Sending cutoff:', cutoff);

// Simulate client fetch
fetch(`http://localhost:3000/api/excursions?cutoff=${cutoff}`)
  .then(res => {
      console.log('Status:', res.status);
      return res.json();
  })
  .then(data => {
      console.log('Returned excursions count:', data.length);
      data.forEach(e => {
          console.log(`- ${e.name} (${e.startDate} - ${e.endDate})`);
      });
  })
  .catch(err => console.error('Error:', err));
