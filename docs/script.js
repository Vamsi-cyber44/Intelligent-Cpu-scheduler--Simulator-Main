import { calculateFCFS } from './algorithms/fcfs.js';
import { calculateSJF } from './algorithms/sjf.js';
import { calculateSRTF } from './algorithms/srtf.js';
import { calculateRR } from './algorithms/roundRobin.js';
import { calculatePriorityNP, calculatePriorityP } from './algorithms/priority.js';
import { startLiveVisualization, togglePause, resetSimulation } from './visuallive.js';

// Make functions globally available
window.lastResult = null;
window.processInput = processInput;
window.calculateScheduling = calculateScheduling;
window.startLiveSimulation = startLiveSimulation;
window.togglePause = togglePause;
window.resetSimulation = resetSimulation;
window.startLiveVisualization = startLiveVisualization;
window.suggestBestAlgorithm = suggestBestAlgorithm;

let processes = [];
let processCounter = 1;

// Theme toggle (dark mode is default; checkbox toggles light mode)
const themeToggle = document.getElementById('checkbox');
const modeIndicator = document.getElementById('modeIndicator');

function setTheme(isLight) {
    if (isLight) {
        document.body.classList.add('light-mode');
        modeIndicator.textContent = 'Light Mode';
    } else {
        document.body.classList.remove('light-mode');
        modeIndicator.textContent = 'Dark Mode';
    }
}

// Check for saved user preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    themeToggle.checked = true;
    modeIndicator.textContent = 'Light Mode';
}

themeToggle.addEventListener('change', () => {
    const isLight = themeToggle.checked;
    setTheme(isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

// Reset algorithm selection on page load
window.addEventListener('load', () => {
    document.getElementById('algorithm').selectedIndex = 0;
    document.getElementById('arrivalInput').value = '';
    document.getElementById('burstInput').value = '';
    document.getElementById('priorityValues').value = '';
    processes = [];
    processCounter = 1;
    updateProcessTable();
    resetSimulation();
});

// Show/hide inputs based on algorithm selection
document.getElementById('algorithm').addEventListener('change', function() {
    const priorityInput = document.getElementById('priorityInput');
    const timeQuantumInput = document.getElementById('timeQuantumInput');
    const priorityColumn = document.querySelectorAll('.priority-column');
    
    priorityInput.style.display = 'none';
    timeQuantumInput.style.display = 'none';
    priorityColumn.forEach(el => el.style.display = 'none');

    if (this.value.includes('priority')) {
        priorityInput.style.display = 'block';
        priorityColumn.forEach(el => el.style.display = 'table-cell');
    } else if (this.value === 'rr') {
        timeQuantumInput.style.display = 'block';
    }
    
    updateProcessTable();
});

function processInput() {
    const arrivalTimes = document.getElementById('arrivalInput').value.trim().split(/\s+/).map(Number);
    const burstTimes = document.getElementById('burstInput').value.trim().split(/\s+/).map(Number);
    const priorityValues = document.getElementById('algorithm').value.includes('priority') ?
        document.getElementById('priorityValues').value.trim().split(/\s+/).map(Number) : [];
    
    processes = [];
    processCounter = 1;

    if (burstTimes.length !== arrivalTimes.length) {
        alert('Number of arrival times and burst times must match!');
        return;
    }

    if (priorityValues.length > 0 && priorityValues.length !== arrivalTimes.length) {
        alert('Number of priority values must match number of processes!');
        return;
    }

    if (arrivalTimes.some(isNaN) || burstTimes.some(isNaN) || burstTimes.some(x => x <= 0)) {
        alert('Invalid input! Please enter valid numbers.');
        return;
    }

    for (let i = 0; i < arrivalTimes.length; i++) {
        processes.push({
            id: processCounter++,
            arrivalTime: arrivalTimes[i],
            burstTime: burstTimes[i],
            remainingTime: burstTimes[i],
            priority: priorityValues[i] || 0,
            startTime: -1,
            finishTime: -1,
            turnaroundTime: 0,
            waitingTime: 0,
            responseTime: -1
        });
    }

    updateProcessTable();
}

function updateProcessTable() {
    const tbody = document.getElementById('processTableBody');
    const algorithm = document.getElementById('algorithm').value;
    tbody.innerHTML = '';

    processes.forEach(process => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>P${process.id}</td>
            <td>${process.arrivalTime}</td>
            <td>${process.burstTime}</td>
            ${algorithm.includes('priority') ? `<td class="priority-column">${process.priority}</td>` : ''}
        `;
        tbody.appendChild(row);
    });
}

async function calculateScheduling() {
    if (processes.length === 0) {
        alert('Please add processes first');
        return;
    }

    const algorithm = document.getElementById('algorithm').value;
    const algorithmNames = {
        'fcfs': 'First Come First Served (FCFS)',
        'sjf': 'Shortest Job First (Non-preemptive)',
        'srtf': 'Shortest Remaining Time First (Preemptive)',
        'rr': 'Round Robin',
        'priority-np': 'Priority (Non-preemptive)',
        'priority-p': 'Priority (Preemptive)'
    };
    
    document.getElementById('currentAlgorithm').textContent = algorithmNames[algorithm];
    
    let result;
    
    try {
        switch(algorithm) {
            case 'fcfs':
                result = calculateFCFS(processes);
                break;
            case 'sjf':
                result = calculateSJF(processes);
                break;
            case 'srtf':
                result = calculateSRTF(processes);
                break;
            case 'rr':
                const quantum = parseInt(document.getElementById('timeQuantum').value);
                if (isNaN(quantum) || quantum <= 0) {
                    alert('Please enter a valid Time Quantum for Round Robin.');
                    return;
                }
                result = calculateRR(processes, quantum);
                break;
            case 'priority-np':
                result = calculatePriorityNP(processes);
                break;
            case 'priority-p':
                result = calculatePriorityP(processes);
                break;
            default:
                alert('Please select an algorithm');
                return;
        }

        window.lastResult = result;
        displayResults(result.processes);
        createGanttChart(result.timeline);
        resetSimulation();
        
    } catch (error) {
        console.error('Error in calculation:', error);
        alert('Error calculating schedule');
    }
}

function displayResults(processQueue) {
    const resultTable = document.getElementById('resultTable');
    const timeline = window.lastResult ? window.lastResult.timeline : [];
    
    // 1. Calculations
    const validProcesses = processQueue.filter(p => p.turnaroundTime >= 0);
    const numProcesses = validProcesses.length;
    const totalTime = timeline.length > 0 ? timeline[timeline.length - 1].endTime : 0;
    
    // CPU Utilization: (totalTime - idleTime) / totalTime
    const idleTime = timeline
        .filter(block => block.processId === 'idle')
        .reduce((sum, block) => sum + (block.endTime - block.startTime), 0);
    const busyTime = totalTime - idleTime;
    const cpuUtilization = totalTime > 0 ? ((busyTime / totalTime) * 100).toFixed(2) : '0.00';
    
    // Throughput: processes / totalTime
    const throughput = totalTime > 0 ? (numProcesses / totalTime).toFixed(4) : '0.0000';
    
    // Context Switches: Transition between DIFFERENT processes (ignoring idle)
    let contextSwitches = 0;
    let lastProcessId = null;
    timeline.forEach(block => {
        if (block.processId !== 'idle') {
            if (lastProcessId !== null && block.processId !== lastProcessId) {
                contextSwitches++;
            }
            lastProcessId = block.processId;
        }
    });

    // Helper for stats
    const getStats = (arr) => {
        if (arr.length === 0) return { avg: '0.00', min: 0, max: 0 };
        const sum = arr.reduce((s, v) => s + v, 0);
        return {
            avg: (sum / arr.length).toFixed(2),
            min: Math.min(...arr),
            max: Math.max(...arr)
        };
    };

    const tatStats = getStats(validProcesses.map(p => p.turnaroundTime));
    const wtStats = getStats(validProcesses.map(p => p.waitingTime));
    const rtStats = getStats(validProcesses.map(p => p.responseTime));

    // 2. Build Dashboard HTML
    let html = `
        <div class="metrics-dashboard">
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">⚡</div>
                    <div class="metric-label">Avg Waiting Time</div>
                    <div class="metric-value">${wtStats.avg}<span class="metric-unit">ms</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">📊</div>
                    <div class="metric-label">CPU Utilization</div>
                    <div class="metric-value">${cpuUtilization}<span class="metric-unit">%</span></div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">🔁</div>
                    <div class="metric-label">Context Switches</div>
                    <div class="metric-value">${contextSwitches}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-icon">🚀</div>
                    <div class="metric-label">Throughput</div>
                    <div class="metric-value">${throughput}<span class="metric-unit">p/s</span></div>
                </div>
            </div>

            <div class="stats-table-container">
                <h3>📊 Detailed Performance Analytics</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Average</th>
                            <th>Minimum</th>
                            <th>Maximum</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Turnaround Time</td>
                            <td>${tatStats.avg}ms</td>
                            <td>${tatStats.min}ms</td>
                            <td>${tatStats.max}ms</td>
                        </tr>
                        <tr>
                            <td>Waiting Time</td>
                            <td>${wtStats.avg}ms</td>
                            <td>${wtStats.min}ms</td>
                            <td>${wtStats.max}ms</td>
                        </tr>
                        <tr>
                            <td>Response Time</td>
                            <td>${rtStats.avg}ms</td>
                            <td>${rtStats.min}ms</td>
                            <td>${rtStats.max}ms</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <h3>Process Execution Details</h3>
        <table>
            <thead>
                <tr>
                    <th>Process</th>
                    <th>Completion</th>
                    <th>Turnaround</th>
                    <th>Waiting</th>
                    <th>Response</th>
                </tr>
            </thead>
            <tbody>
    `;

    processQueue.forEach(process => {
        html += `
            <tr>
                <td>P${process.id}</td>
                <td>${process.finishTime}</td>
                <td>${process.turnaroundTime}</td>
                <td>${process.waitingTime}</td>
                <td>${process.responseTime}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    resultTable.innerHTML = html;
}

function createGanttChart(timeline) {
    const ganttChart = document.getElementById('ganttChart');
    ganttChart.innerHTML = '';

    timeline.forEach((block, i) => {
        const div = document.createElement('div');
        div.className = 'gantt-block';
        div.style.animationDelay = `${i * 0.06}s`;
        
        if (block.processId === 'idle') {
            div.classList.add('idle');
            div.innerHTML = `
                <div>Idle</div>
                <div>${block.startTime}–${block.endTime}</div>
            `;
        } else {
            const hue = (block.processId * 137.5) % 360;
            div.style.backgroundColor = `hsl(${hue}, 65%, 55%)`;
            div.style.borderColor = `hsl(${hue}, 65%, 45%)`;
            div.innerHTML = `
                <div>P${block.processId}</div>
                <div>${block.startTime}–${block.endTime}</div>
            `;
        }
        
        ganttChart.appendChild(div);
    });

    ganttChart.scrollLeft = 0;
}

function startLiveSimulation() {
    if(window.lastResult) {
        startLiveVisualization(window.lastResult);
    } else {
        alert('Please calculate schedule first');
    }
}

function suggestBestAlgorithm() {
    if (processes.length === 0) {
        alert('Please add processes first');
        return;
    }

    const suggestionCard = document.getElementById('suggestionCard');
    const bestAlgoName = document.getElementById('bestAlgoName');
    
    // Deep copy processes to avoid modifying the original process array
    const getProcessesCopy = () => processes.map(p => ({ ...p }));
    
    // Algorithms to test
    const testAlgos = [
        { id: 'fcfs', name: 'First Come First Served', run: (p) => calculateFCFS(p) },
        { id: 'sjf', name: 'Shortest Job First (NP)', run: (p) => calculateSJF(p) },
        { id: 'srtf', name: 'Shortest Remaining Time First (P)', run: (p) => calculateSRTF(p) },
        { id: 'rr', name: 'Round Robin (Q=2)', run: (p) => {
            const q = parseInt(document.getElementById('timeQuantum').value) || 2;
            return calculateRR(p, q);
        }},
        { id: 'priority-np', name: 'Priority (Non-preemptive)', run: (p) => calculatePriorityNP(p) },
        { id: 'priority-p', name: 'Priority (Preemptive)', run: (p) => calculatePriorityP(p) }
    ];

    let bestAlgo = null;
    let minAvgWaiting = Infinity;

    testAlgos.forEach(algo => {
        try {
            const result = algo.run(getProcessesCopy());
            const validProcesses = result.processes.filter(p => p.turnaroundTime >= 0);
            const avgWaiting = validProcesses.reduce((sum, p) => sum + p.waitingTime, 0) / validProcesses.length;
            
            if (avgWaiting < minAvgWaiting) {
                minAvgWaiting = avgWaiting;
                bestAlgo = algo;
            }
        } catch (e) {
            console.warn(`Could not run ${algo.name} during suggestion:`, e);
        }
    });

    if (bestAlgo) {
        bestAlgoName.textContent = bestAlgo.name;
        suggestionCard.style.display = 'block';
        suggestionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}