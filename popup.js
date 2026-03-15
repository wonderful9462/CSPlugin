const recordBtn = document.getElementById('recordBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const statsList = document.getElementById('statsList');
const totalBar = document.getElementById('totalBar');

async function refreshUI() {
  const { recording } = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
  const { data, stats } = await chrome.runtime.sendMessage({ type: 'GET_DATA' });

  recordBtn.textContent = recording ? '停止录制' : '开始录制';
  recordBtn.classList.toggle('recording', recording);

  const entries = Object.entries(stats);
  if (entries.length === 0) {
    statsList.className = 'stats-empty';
    statsList.textContent = '暂无数据，开始录制后访问商品页即可抓取';
    totalBar.style.display = 'none';
  } else {
    statsList.className = '';
    statsList.innerHTML = entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) =>
        `<div class="stats-item"><span class="stats-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span><span class="stats-count">${count}</span></div>`
      )
      .join('');
    totalBar.style.display = 'block';
    totalBar.textContent = `共 ${data.length} 条`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

recordBtn.addEventListener('click', async () => {
  const { recording } = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
  await chrome.runtime.sendMessage({ type: 'SET_RECORDING_STATE', recording: !recording });
  refreshUI();
});

saveBtn.addEventListener('click', async () => {
  const { data } = await chrome.runtime.sendMessage({ type: 'GET_DATA' });
  if (data.length === 0) {
    alert('暂无数据可保存');
    return;
  }
  const jsonl = data.map(item => JSON.stringify(item)).join('\n');
  const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cs2ct_${Date.now()}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定要清除所有抓取数据吗？')) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_DATA' });
  refreshUI();
});

setInterval(refreshUI, 1000);
refreshUI();
