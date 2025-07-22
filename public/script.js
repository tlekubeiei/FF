document.getElementById('report-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);

  const res = await fetch('/report', {
    method: 'POST',
    body: formData
  });

  const result = await res.json();
  document.getElementById('result').innerText = result.message || result.error;
  form.reset();
});

document.getElementById('viewReportsBtn').addEventListener('click', () => {
  window.location.href = '/reports.html';
});