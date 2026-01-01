<script>
  let token = '';
  let view = 'main'; 
  let scannedCode = '';
  let garageName = '';
  let parkingTime = '';

  function authenticate() {
      return new Promise((resolve, reject) => {
          my.getAuthCode({
              scopes: ['auth_base', 'USER_ID'],
              success: (res) => {
                  const authCode = res.authCode;
                  my.alert({ content: 'Got auth code: ' + authCode });

                  fetch('https://its.mouamle.space/api/auth-with-superQi', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: authCode })
                  }).then(r => {
                      if (!r.ok) throw new Error('Auth API error ' + r.status);
                      return r.json();
                  }).then(data => {
                      token = data.token;
                      my.alert({ content: 'Login successful' });
                      resolve(token);
                  }).catch(err => {
                      my.alert({ content: 'Authentication failed: ' + (err && err.message ? err.message : JSON.stringify(err)) });
                      reject(err);
                  });
              },
              fail: (res) => {
                  my.alert({ content: 'getAuthCode failed: ' + JSON.stringify(res) });
                  reject(res);
              }
          });
      });
  }

  function pay() {
      fetch('https://its.mouamle.space/api/payment', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': token
          },
      }).then(res => res.json()).then(data => {
          my.tradePay({ paymentUrl: data.url, success: () => my.alert({ content: 'Payment successful' }) });
      }).catch(err => {
          my.alert({ content: 'Payment failed' });
      });
  }

  function scan() {
      my.confirm({
          title: 'Authentication required',
          content: 'Allow authentication to proceed with scanning?',
          confirmButtonText: 'Allow',
          cancelButtonText: 'Cancel',
          success: (res) => {
              const allowed = res && (
                  res.confirm === true ||
                  res === true ||
                  res.confirm === 'confirm' ||
                  res.ok === true
              );
              if (!allowed) return;
              authenticate().then(() => {
                  my.scan({
                      type: 'qr',
                      success: (res) => {
                          scannedCode = res.code;

                          fetch('https://its.mouamle.space/api/garage-info', {
                              method: 'POST',
                              headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': token
                              },
                               body: JSON.stringify({ code: scannedCode })
                          }).then(r => r.json()).then(data => {
                              garageName = data.name || ('Garage ' + scannedCode);
                              parkingTime = data.parkingTime || '1 hour';
                              view = 'details';
                          }).catch(() => {
                              garageName = 'Garage ' + scannedCode;
                              parkingTime = '1 hour';
                              view = 'details';
                          });
                      },
                      fail: () => my.alert({ content: 'Scan failed' })
                  });
              }).catch(() => my.alert({ content: 'Authentication required to scan' }));
          }
      });
  }

  function backToMain() {
      view = 'main';
  }

  // Dummy History Data
  let history = [
    { id: 1, location: 'Central Garage', time: 'Today, 09:00 AM', status: 'Present' },
    { id: 2, location: 'North Campus', time: 'Yesterday, 08:30 AM', status: 'Late' },
    { id: 3, location: 'West Wing', time: 'Oct 30, 09:15 AM', status: 'Present' },
    { id: 4, location: 'Main Hall', time: 'Oct 29, 10:00 AM', status: 'Late' }
  ];
</script>

<main class="container">
  {#if view === 'main'}
    <div class="view main-view">
      <header class="header">
        <h1>Hello, User</h1>
        <p>Welcome to Super Qi Attendance</p>
      </header>

      <div class="card history-card">
        <div class="card-header">
          <h2>Attendance History</h2>
          <span class="badge">Recent</span>
        </div>
        <ul class="history-list">
          {#each history as item}
            <li class="history-item">
              <div class="history-info">
                <h3>{item.location}</h3>
                <span class="time">{item.time}</span>
              </div>
              <div class="history-actions">
                <span class="status {item.status.toLowerCase()}">{item.status}</span>
                {#if item.status === 'Late'}
                  <button class="btn-pay-small" on:click={pay}>Pay Fine</button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </div>

      <div class="scan-section">
        <button class="btn-scan" on:click={scan}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path></svg>
          Scan Attendance
        </button>
        <button class="btn-text" on:click={authenticate}>Login / Re-authenticate</button>
      </div>
    </div>
  {:else if view === 'details'}
    <div class="view details-view">
      <div class="card details-card">
        <div class="icon-check">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h2>Attendance Recorded</h2>
        <div class="detail-row">
          <span class="label">Location</span>
          <span class="value">{garageName}</span>
        </div>
        <div class="detail-row">
          <span class="label">Duration</span>
          <span class="value">{parkingTime}</span>
        </div>
        
        <button class="btn-primary" on:click={backToMain}>Back to Home</button>
        <button class="btn-secondary" on:click={pay}>Pay Fine (If Applicable)</button>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f0f2f5;
    color: #333;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    background-color: #fff;
    position: relative;
    box-shadow: 0 0 20px rgba(0,0,0,0.05);
  }

  .view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
  }

  /* Main View */
  .header {
    margin-bottom: 30px;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px 0;
    color: #1a1a1a;
  }
  .header p {
    margin: 0;
    color: #666;
    font-size: 16px;
  }

  .card {
    background: white;
    border-radius: 16px;
    padding: 2px; /* Gradient border trick maybe? or just clean */
    /* Let's go for clean shadow */
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    margin-bottom: 24px;
    overflow: hidden;
  }

  .history-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;
  }

  .card-header h2 {
    font-size: 18px;
    margin: 0;
    font-weight: 600;
  }

  .history-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #f9f9f9;
  }
  .history-item:last-child {
    border-bottom: none;
  }

  .history-info h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 500;
  }
  .history-info .time {
    font-size: 13px;
    color: #888;
  }

  .history-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .status {
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 12px;
  }
  .status.present {
    background-color: #e6f7ed;
    color: #1a7f37;
  }
  .status.late {
    background-color: #fff0eb;
    color: #d1242f;
  }

  .scan-section {
    margin-top: auto;
    padding-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  /* Buttons */
  button {
    cursor: pointer;
    border: none;
    outline: none;
    font-family: inherit;
    transition: all 0.2s ease;
  }

  .btn-scan {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #1677ff 0%, #0050b3 100%);
    color: white;
    font-size: 18px;
    font-weight: 600;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 8px 20px rgba(22, 119, 255, 0.3);
  }
  .btn-scan:active {
    transform: scale(0.98);
  }

  .btn-pay-small {
    background-color: #fff1f0;
    color: #f5222d;
    border: 1px solid #ffa39e;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }
  .btn-pay-small:hover {
    background-color: #ffccc7;
  }

  .btn-text {
    background: none;
    color: #666;
    font-size: 14px;
    text-decoration: underline;
  }

  /* Details View */
  .details-view {
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f0f2f5 0%, #e6f7ff 100%);
  }

  .details-card {
    width: 100%;
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .icon-check {
    width: 80px;
    height: 80px;
    background: #52c41a;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    box-shadow: 0 10px 20px rgba(82, 196, 26, 0.3);
  }

  .details-card h2 {
    margin: 0 0 24px 0;
    color: #1a1a1a;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .detail-row .label {
    color: #888;
  }
  .detail-row .value {
    font-weight: 600;
    color: #333;
  }

  .btn-primary {
    width: 100%;
    margin-top: 32px;
    padding: 14px;
    background: #1677ff;
    color: white;
    font-size: 16px;
    font-weight: 600;
    border-radius: 8px;
  }
  .btn-secondary {
    width: 100%;
    margin-top: 12px;
    padding: 14px;
    background: white;
    border: 1px solid #d9d9d9;
    color: #333;
    font-size: 16px;
    font-weight: 500;
    border-radius: 8px;
  }
</style>
