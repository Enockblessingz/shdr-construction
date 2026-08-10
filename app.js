// app.js – Main application logic (complete, fixed)

let currentUser = null;
let currentView = 'dashboard';
let sites = [], materials = [], workers = [], dailyReports = [];
let suppliers = [], purchaseOrders = [], photos = [], auditLogs = [];
let dailyWorkerDeployments = [], workerMaster = [];

const MATERIAL_MASTER = [
    { name: 'Cement', category: 'Cement & Concrete', unit: 'bags', default_cost: 5500 },
    { name: 'Sand', category: 'Aggregates', unit: 'tons', default_cost: 18000 },
    { name: 'Aggregates (Gravel)', category: 'Aggregates', unit: 'tons', default_cost: 22000 },
    { name: 'Clay Bricks', category: 'Bricks & Blocks', unit: 'pieces', default_cost: 50 },
    { name: 'Steel Bars (10mm)', category: 'Steel & Metal', unit: 'kg', default_cost: 1200 },
    { name: 'Steel Bars (12mm)', category: 'Steel & Metal', unit: 'kg', default_cost: 1400 },
    { name: 'Roofing Sheets', category: 'Roofing', unit: 'sheets', default_cost: 45000 },
    { name: 'Water', category: 'Other', unit: 'm³', default_cost: 3000 },
    { name: 'Paint', category: 'Finishes', unit: 'litres', default_cost: 8500 },
    { name: 'Tiles', category: 'Finishes', unit: 'm²', default_cost: 15000 },
    { name: 'Timber', category: 'Other', unit: 'pieces', default_cost: 5000 },
    { name: 'PVC Pipes', category: 'Plumbing', unit: 'meters', default_cost: 2500 },
    { name: 'Nails', category: 'Hardware', unit: 'kg', default_cost: 3000 },
    { name: 'Concrete Blocks', category: 'Bricks & Blocks', unit: 'pieces', default_cost: 800 }
];

// ==================== INITIALISATION (FIXED) ====================
(async function() {
    if (typeof initSupabase !== 'function') {
        console.error('auth.js not loaded – initSupabase missing');
        return;
    }
    initSupabase();
    const session = await restoreSession();
    if (!session) return;

    // 1. Try localStorage
    currentUser = JSON.parse(localStorage.getItem('shdr_user'));

    // 2. If missing, build from session metadata (no DB call)
    if (!currentUser) {
        try {
            const { data: { user } } = await window.shdrSupabase.auth.getUser();
            if (user) {
                const meta = user.user_metadata || {};
                currentUser = {
                    id: user.id,
                    email: user.email,
                    name: meta.full_name || 'User',
                    role: meta.role || 'manager',
                    phone: meta.phone || ''
                };
                localStorage.setItem('shdr_user', JSON.stringify(currentUser));
            }
        } catch (e) {
            console.error('Failed to restore user from session:', e);
            await signOut();
            window.location.href = 'login.html';
            return;
        }
    }

    if (!currentUser) {
        await signOut();
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display').textContent = currentUser.name;

    await loadAllData();
    buildNavigation();
    navigateTo('dashboard');
    lucide.createIcons();

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await signOut();
        localStorage.removeItem('shdr_user');
        window.location.href = 'login.html';
    });
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar-overlay').classList.remove('hidden');
        document.getElementById('mobile-sidebar').classList.remove('hidden');
    });
})();

// ==================== DATA LOADING (USES window.shdrSupabase) ====================
async function loadAllData() {
    try {
        const [
            sitesRes, materialsRes, workersRes, reportsRes,
            suppliersRes, posRes, photosRes, auditRes,
            deploymentsRes, workersMasterRes
        ] = await Promise.all([
            window.shdrSupabase.from('sites').select('*'),
            window.shdrSupabase.from('material_usage').select('*'),
            window.shdrSupabase.from('daily_labor').select('*'),
            window.shdrSupabase.from('daily_reports').select('*'),
            window.shdrSupabase.from('suppliers').select('*'),
            window.shdrSupabase.from('purchase_orders').select('*'),
            window.shdrSupabase.from('site_photos').select('*'),
            window.shdrSupabase.from('audit_logs').select('*'),
            window.shdrSupabase.from('worker_deployments').select('*'),
            window.shdrSupabase.from('worker_master').select('*')
        ]);
        sites = sitesRes.data || [];
        materials = materialsRes.data || [];
        workers = workersRes.data || [];
        dailyReports = reportsRes.data || [];
        suppliers = suppliersRes.data || [];
        purchaseOrders = posRes.data || [];
        photos = photosRes.data || [];
        auditLogs = auditRes.data || [];
        dailyWorkerDeployments = deploymentsRes.data || [];
        workerMaster = workersMasterRes.data || [];
    } catch (error) {
        console.error('Data loading failed:', error);
        showToast('Failed to load data', 'error');
    }
}

// ==================== NAVIGATION ====================
const adminNavConfig = [
    { id:'dashboard', label:'Dashboard', icon:'layout-dashboard' },
    { id:'sites', label:'Sites', icon:'building' },
    { id:'materials', label:'Materials', icon:'package' },
    { id:'workers', label:'Workers', icon:'hard-hat' },
    { id:'daily-workers', label:'Daily Workers', icon:'users' },
    { id:'suppliers', label:'Suppliers', icon:'truck' },
    { id:'purchase-orders', label:'Purchase Orders', icon:'file-text' },
    { id:'photos', label:'Photos', icon:'camera' },
    { id:'reports', label:'Reports', icon:'bar-chart-3' },
    { id:'audit-logs', label:'Audit Logs', icon:'shield-alert' }
];
const managerNavConfig = [
    { id:'dashboard', label:'Dashboard', icon:'layout-dashboard' },
    { id:'daily-entry', label:'Daily Entry', icon:'clipboard-list' },
    { id:'materials', label:'Materials', icon:'package' },
    { id:'daily-workers', label:'Daily Workers', icon:'users' },
    { id:'photos', label:'Photos', icon:'camera' },
    { id:'reports', label:'Reports', icon:'bar-chart-3' }
];

function isUserAuthorized(viewId) {
    if (currentUser.role === 'admin') return true;
    return ['dashboard', 'daily-entry', 'materials', 'daily-workers', 'photos', 'reports'].includes(viewId);
}

function buildNavigation() {
    const navItems = currentUser.role === 'admin' ? adminNavConfig : managerNavConfig;
    const makeItem = (item) => {
        if (!isUserAuthorized(item.id)) return '';
        return `<button onclick="navigateTo('${item.id}')" class="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors ${currentView===item.id?'active':''}">
            <i data-lucide="${item.icon}" class="w-4 h-4"></i><span>${item.label}</span>
        </button>`;
    };
    document.getElementById('nav-items').innerHTML = navItems.map(makeItem).join('');
    document.getElementById('mobile-nav-items').innerHTML = document.getElementById('nav-items').innerHTML;
    const bottomItems = navItems.filter(i => isUserAuthorized(i.id)).slice(0,4);
    document.getElementById('bottom-nav').innerHTML = bottomItems.map(item => `
        <button onclick="navigateTo('${item.id}')" class="flex-1 flex flex-col items-center py-2 text-xs ${currentView===item.id?'text-green-600 font-semibold':'text-slate-400'}">
            <i data-lucide="${item.icon}" class="w-5 h-5 mb-0.5"></i><span class="text-xs">${item.label}</span>
        </button>`).join('');
    lucide.createIcons();
}

function navigateTo(view) {
    currentView = view;
    closeMobileNav();
    buildNavigation();
    renderCurrentView();
}

function closeMobileNav() {
    document.getElementById('sidebar-overlay').classList.add('hidden');
    document.getElementById('mobile-sidebar').classList.add('hidden');
}

// ==================== TOAST ====================
function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = `toast px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${type==='success'?'bg-green-600':'bg-red-500'}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ==================== RENDER DISPATCH ====================
function renderCurrentView() {
    if (!isUserAuthorized(currentView)) currentView = 'dashboard';
    const content = document.getElementById('content');
    switch(currentView) {
        case 'dashboard': content.innerHTML = renderDashboard(); break;
        case 'sites': content.innerHTML = renderSites(); break;
        case 'materials': content.innerHTML = renderMaterials(); break;
        case 'workers': content.innerHTML = renderWorkers(); break;
        case 'daily-workers': content.innerHTML = renderDailyWorkers(); break;
        case 'daily-entry': content.innerHTML = renderDailyEntry(); break;
        case 'suppliers': content.innerHTML = renderSuppliers(); break;
        case 'purchase-orders': content.innerHTML = renderPurchaseOrders(); break;
        case 'photos': content.innerHTML = renderPhotos(); break;
        case 'reports': content.innerHTML = renderReports(); break;
        case 'audit-logs': content.innerHTML = renderAuditLogs(); break;
    }
    lucide.createIcons();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
    const activeSites = sites.filter(s => s.status === 'In Progress' || s.status === 'ongoing').length;
    const totalLaborCost = workers.reduce((s,w) => s + (w.total_cost||0), 0);
    const today = new Date().toISOString().split('T')[0];
    const todayMaterials = materials.filter(m => m.usage_date === today).length;
    const todayWorkers = workers.filter(w => w.report_date === today).length;
    const todayLabor = workers.filter(w => w.report_date === today).reduce((s,w) => s + (w.total_cost||0), 0);

    return `<div class="fade-in space-y-6 pb-20 lg:pb-0">
        <div><h1 class="text-2xl font-bold text-slate-900">${currentUser.role==='admin'?'Admin Dashboard':'Site Manager Dashboard'}</h1><p class="text-slate-500 text-sm">Welcome, ${currentUser.name}</p></div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            ${statCard('Active Sites', activeSites, 'building', 'bg-blue-50 text-blue-600')}
            ${statCard('Sites', sites.length, 'map-pin', 'bg-purple-50 text-purple-600')}
            ${statCard("Today's Labor", todayLabor.toLocaleString()+' RWF', 'wallet', 'bg-green-50 text-green-600')}
            ${statCard('Total Labor', totalLaborCost.toLocaleString()+' RWF', 'trending-up', 'bg-amber-50 text-amber-600')}
        </div>
        <div class="grid md:grid-cols-2 gap-4">
            <div class="bg-white rounded-2xl p-5 border border-slate-200">
                <h3 class="font-semibold text-slate-900 mb-3">🔨 Active Sites</h3>
                ${sites.filter(s => s.status==='In Progress'||s.status==='ongoing').slice(0,5).map(s => `<div class="flex justify-between py-2 border-b border-slate-100 text-sm"><span class="font-medium">${s.site_name}</span><span class="text-slate-400">${s.manager_id||'Unassigned'}</span></div>`).join('')||'<p class="text-slate-400 text-sm">No active sites</p>'}
            </div>
            <div class="bg-white rounded-2xl p-5 border border-slate-200">
                <h3 class="font-semibold text-slate-900 mb-3">📋 Recent Daily Reports</h3>
                ${dailyReports.slice(-3).reverse().map(r => `<div class="py-2 border-b border-slate-100 text-sm"><p class="font-medium">Site #${r.site_id}</p><p class="text-xs text-slate-400">${r.report_date} - ${r.weather}</p></div>`).join('')||'<p class="text-slate-400 text-sm">No reports</p>'}
            </div>
        </div>
    </div>`;
}

function statCard(label, value, icon, colorClass) {
    return `<div class="bg-white rounded-2xl p-4 border border-slate-200 card-hover">
        <div class="w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center mb-3"><i data-lucide="${icon}" class="w-5 h-5"></i></div>
        <p class="text-lg font-bold text-slate-900">${value}</p>
        <p class="text-xs text-slate-500 mt-0.5">${label}</p>
    </div>`;
}

// ==================== SITES ====================
function renderSites() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Construction Sites</h1>
            ${currentUser.role==='admin'?`<button onclick="showSiteForm()" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i>Add Site</button>`:''}
        </div>
        <div id="site-form-area"></div>
        <div class="grid gap-3">
            ${sites.length ? sites.map(s => `
                <div class="bg-white rounded-2xl p-4 border border-slate-200 card-hover">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-semibold text-slate-900">${s.site_name}</h3>
                            <p class="text-sm text-slate-500">${s.location||'No location'}</p>
                            <p class="text-xs text-slate-400 mt-1">${s.start_date||'N/A'} → ${s.expected_end_date||'Ongoing'}</p>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-medium ${s.status==='In Progress'||s.status==='ongoing'?'bg-green-100 text-green-700':'bg-slate-100 text-slate-600'}">${s.status}</span>
                    </div>
                </div>`).join('') : '<div class="text-center py-12"><p class="text-slate-400">No sites added yet</p></div>'}
        </div>
    </div>`;
}

function showSiteForm() {
    document.getElementById('site-form-area').innerHTML = `
        <form onsubmit="saveSite(event)" class="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
            <h3 class="font-semibold text-slate-900">New Construction Site</h3>
            <input id="sf-name" placeholder="Site Name *" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <div class="grid grid-cols-2 gap-3">
                <input id="sf-district" placeholder="District" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <input id="sf-sector" placeholder="Sector" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <input id="sf-location" placeholder="GPS Location / Address" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <input id="sf-client" placeholder="Client Name" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <input id="sf-contract" type="number" min="0" placeholder="Contract Value (RWF)" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <div class="grid grid-cols-2 gap-3">
                <input id="sf-start" type="date" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <input id="sf-end" type="date" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <input id="sf-manager" placeholder="Assigned Manager" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <select id="sf-status" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="In Progress">In Progress</option><option value="Planning">Planning</option><option value="On Hold">On Hold</option><option value="Completed">Completed</option>
            </select>
            <div class="flex gap-2">
                <button type="submit" class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">Save Site</button>
                <button type="button" onclick="document.getElementById('site-form-area').innerHTML=''" class="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium">Cancel</button>
            </div>
        </form>`;
}

async function saveSite(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await window.shdrSupabase.from('sites').insert({
        site_code: 'SHDR-' + String(sites.length + 1).padStart(4, '0'),
        site_name: document.getElementById('sf-name').value,
        location: document.getElementById('sf-location').value,
        district: document.getElementById('sf-district').value,
        sector: document.getElementById('sf-sector').value,
        client_name: document.getElementById('sf-client').value,
        contract_value: parseFloat(document.getElementById('sf-contract').value || 0),
        start_date: document.getElementById('sf-start').value,
        expected_end_date: document.getElementById('sf-end').value,
        manager_id: currentUser.id,
        status: document.getElementById('sf-status').value,
        created_at: new Date().toISOString()
    });
    if (!error) {
        showToast('Site created!');
        document.getElementById('site-form-area').innerHTML = '';
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to save site', 'error');
        btn.disabled = false;
    }
}

// ... [All remaining functions for materials, workers, etc. are identical to the previously provided app.js, which already use window.shdrSupabase and do NOT query profiles. I'm not repeating them here to save space, but they are unchanged.]

// ==================== MATERIALS ====================
function renderMaterials() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Materials Module</h1>
            <button onclick="toggleBatchForm()" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i>Batch Entry</button>
        </div>
        <div id="batch-form-container"></div>
        <div class="grid md:grid-cols-2 gap-4">
            <div class="bg-white rounded-2xl p-5 border border-slate-200">
                <h3 class="font-semibold text-slate-900 mb-3">Quick Stats</h3>
                <div class="space-y-2">
                    <div class="flex justify-between p-2 bg-slate-50 rounded"><span>Total Entries</span><span class="font-bold">${materials.length}</span></div>
                    <div class="flex justify-between p-2 bg-slate-50 rounded"><span>Total Cost</span><span class="font-bold text-green-600">${materials.reduce((s,m)=>s+(m.total_material_cost||0),0).toLocaleString()} RWF</span></div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-2xl p-5 border border-slate-200">
            <h3 class="font-semibold text-slate-900 mb-3">Recent Entries</h3>
            <div class="space-y-2 max-h-96 overflow-y-auto">
                ${materials.length ? materials.slice().reverse().slice(0,25).map(m => `
                    <div class="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                            <p class="font-medium text-slate-800">${m.material_name}</p>
                            <p class="text-xs text-slate-500">Site ${m.site_id} • ${m.usage_date}</p>
                            <p class="text-xs text-slate-600">${m.quantity} ${m.unit} @ ${m.unit_cost} RWF</p>
                        </div>
                        <div class="text-right">
                            <p class="font-bold text-green-600">${(m.total_material_cost||0).toLocaleString()}</p>
                            ${currentUser.role==='admin'?`<button onclick="deleteMaterial(${m.id})" class="text-xs text-red-500 hover:underline">Delete</button>`:''}
                        </div>
                    </div>`).join('') : '<p class="text-slate-400 text-sm">No entries yet</p>'}
            </div>
        </div>
    </div>`;
}

function toggleBatchForm() {
    const container = document.getElementById('batch-form-container');
    if (container.innerHTML) { container.innerHTML = ''; }
    else { renderBatchForm(); }
}

function renderBatchForm() {
    const container = document.getElementById('batch-form-container');
    container.innerHTML = `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h3 class="font-semibold text-slate-900">Batch Material Entry</h3>
            <div class="grid md:grid-cols-2 gap-4">
                <select id="bf-site" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                    <option value="">Select Site *</option>
                    ${sites.map(s => `<option value="${s.id}">${s.site_name}</option>`).join('')}
                </select>
                <input id="bf-date" type="date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <div>
                <label class="text-sm font-medium text-slate-700 block mb-2">Select Materials</label>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                    ${MATERIAL_MASTER.map(m => `
                        <label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                            <input type="checkbox" value="${m.name}" class="material-checkbox w-4 h-4 rounded" onchange="updateBatchTable()">
                            <span class="text-xs text-slate-700">${m.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div id="batch-table-container"></div>
            <div class="flex gap-2">
                <button type="button" onclick="saveBatch()" class="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium">💾 Save Batch</button>
                <button type="button" onclick="toggleBatchForm()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
            </div>
        </div>`;
}

function updateBatchTable() {
    const selected = [...document.querySelectorAll('.material-checkbox:checked')].map(c => c.value);
    const container = document.getElementById('batch-table-container');
    if (selected.length === 0) { container.innerHTML = ''; return; }
    let html = `<div class="border border-slate-200 rounded-lg overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-100 border-b"><tr><th class="px-3 py-2 text-left">Material</th><th class="px-3 py-2 text-left">Unit</th><th class="px-3 py-2 text-right">Qty</th><th class="px-3 py-2 text-right">Unit Cost</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2">Notes</th></tr></thead><tbody>`;
    selected.forEach((matName, idx) => {
        const matData = MATERIAL_MASTER.find(m => m.name === matName);
        html += `<tr class="border-b hover:bg-slate-50">
            <td class="px-3 py-2"><span class="font-medium">${matName}</span></td>
            <td class="px-3 py-2 text-slate-600">${matData.unit}</td>
            <td class="px-3 py-2"><input type="number" class="batch-qty w-full px-2 py-1 rounded border text-right" min="0" step="0.1" data-idx="${idx}" onchange="updateBatchTotal()"></td>
            <td class="px-3 py-2"><input type="number" class="batch-cost w-full px-2 py-1 rounded border text-right" min="0" step="0.01" value="${matData.default_cost}" data-idx="${idx}" onchange="updateBatchTotal()"></td>
            <td class="px-3 py-2 text-right"><span class="batch-total font-bold text-green-600" data-idx="${idx}">0</span></td>
            <td class="px-3 py-2"><input type="text" class="batch-notes w-full px-2 py-1 rounded border text-xs" placeholder="Notes" data-idx="${idx}"></td>
        </tr>`;
    });
    html += `</tbody><tfoot class="bg-green-50 border-t-2 border-green-200"><tr><td colspan="4" class="px-3 py-2 font-semibold">Grand Total:</td><td class="px-3 py-2 text-right font-bold text-green-600 text-lg"><span id="batch-grand-total">0</span></td><td></td></tr></tfoot></table></div>`;
    container.innerHTML = html;
    updateBatchTotal();
}

function updateBatchTotal() {
    let grand = 0;
    document.querySelectorAll('.batch-qty').forEach(el => {
        const idx = el.dataset.idx;
        const qty = parseFloat(el.value) || 0;
        const cost = parseFloat(document.querySelector(`.batch-cost[data-idx="${idx}"]`).value) || 0;
        const total = qty * cost;
        document.querySelector(`.batch-total[data-idx="${idx}"]`).textContent = total.toLocaleString();
        grand += total;
    });
    const grandEl = document.getElementById('batch-grand-total');
    if (grandEl) grandEl.textContent = grand.toLocaleString() + ' RWF';
}

async function saveBatch() {
    const siteId = document.getElementById('bf-site').value;
    const date = document.getElementById('bf-date').value;
    if (!siteId) { showToast('Select a site', 'error'); return; }
    const rows = [];
    const selected = [...document.querySelectorAll('.material-checkbox:checked')].map(c => c.value);
    document.querySelectorAll('.batch-qty').forEach((el, idx) => {
        const qty = parseFloat(el.value) || 0;
        if (qty === 0) return;
        const matName = selected[idx];
        const cost = parseFloat(document.querySelector(`.batch-cost[data-idx="${idx}"]`).value) || 0;
        const notes = document.querySelector(`.batch-notes[data-idx="${idx}"]`).value;
        rows.push({
            site_id: siteId,
            usage_date: date,
            material_name: matName,
            material_category: MATERIAL_MASTER.find(m => m.name === matName).category,
            quantity: qty,
            unit: MATERIAL_MASTER.find(m => m.name === matName).unit,
            unit_cost: cost,
            total_material_cost: qty * cost,
            notes: notes,
            created_at: new Date().toISOString(),
            created_by: currentUser.name
        });
    });
    if (rows.length === 0) { showToast('Add at least one material', 'error'); return; }
    const { error } = await window.shdrSupabase.from('material_usage').insert(rows);
    if (!error) {
        showToast('Batch saved!');
        document.getElementById('batch-form-container').innerHTML = '';
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to save', 'error');
    }
}

async function deleteMaterial(id) {
    const { error } = await window.shdrSupabase.from('material_usage').delete().eq('id', id);
    if (!error) {
        showToast('Entry deleted');
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to delete', 'error');
    }
}

// ==================== WORKERS (daily labor) ====================
function renderWorkers() {
    const workerTypes = ['Mason','Aid-mason','Carpenter','Welder','Electrician','Plumber','Painter','Labourer','Supervisor','Other'];
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Daily Workers</h1>
            <button onclick="document.getElementById('wrk-form').classList.toggle('hidden')" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i>Log Workers</button>
        </div>
        <form id="wrk-form" class="hidden bg-white rounded-2xl p-5 border border-slate-200 space-y-3" onsubmit="saveWorker(event)">
            <h3 class="font-semibold text-slate-900">Log Worker Deployment</h3>
            <select id="wf-site" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="">Select Site *</option>
                ${sites.map(s => `<option value="${s.id}">${s.site_name}</option>`).join('')}
            </select>
            <input id="wf-date" type="date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <select id="wf-type" required onchange="autoFillWage()" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="">Worker Type *</option>
                ${workerTypes.map(w => `<option>${w}</option>`).join('')}
            </select>
            <div class="grid grid-cols-2 gap-3">
                <input id="wf-num" type="number" min="1" placeholder="No. of Workers *" required oninput="calcWorkerCost()" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <input id="wf-wage" type="number" min="0" placeholder="Daily Wage (RWF) *" required oninput="calcWorkerCost()" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <input id="wf-hours" type="number" step="0.5" min="0" placeholder="Hours Worked (optional)" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <div class="p-3 bg-green-50 rounded-xl text-sm text-green-900">Total Cost: <span id="wf-total" class="font-bold">0 RWF</span></div>
            <button type="submit" class="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">Save Entry</button>
        </form>
        <div class="space-y-2">
            ${workers.length ? workers.slice().reverse().slice(0,20).map(w => `
                <div class="bg-white rounded-xl p-3 border border-slate-200">
                    <div class="flex justify-between">
                        <div>
                            <p class="font-medium text-slate-800">${w.worker_type} × ${w.num_workers} workers</p>
                            <p class="text-xs text-slate-400">Site ${w.site_id} • ${w.report_date} ${w.hours_worked?'• '+w.hours_worked+' hrs':''}</p>
                            <p class="text-sm font-semibold text-green-600 mt-1">${(w.total_cost||0).toLocaleString()} RWF</p>
                        </div>
                        ${currentUser.role==='admin'?`<button onclick="deleteWorker(${w.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`:''}
                    </div>
                </div>`).join('') : '<div class="text-center py-8"><p class="text-slate-400">No worker entries yet</p></div>'}
        </div>
    </div>`;
}

function autoFillWage() {
    const defaults = { 'Mason':15000,'Aid-mason':8000,'Carpenter':12000,'Welder':14000,'Electrician':16000,'Plumber':14000,'Painter':10000,'Labourer':7000,'Supervisor':20000 };
    const type = document.getElementById('wf-type').value;
    if (defaults[type]) document.getElementById('wf-wage').value = defaults[type];
    calcWorkerCost();
}

function calcWorkerCost() {
    const n = parseFloat(document.getElementById('wf-num').value || 0);
    const w = parseFloat(document.getElementById('wf-wage').value || 0);
    document.getElementById('wf-total').textContent = (n*w).toLocaleString()+' RWF';
}

async function saveWorker(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const num = parseInt(document.getElementById('wf-num').value);
    const wage = parseFloat(document.getElementById('wf-wage').value);
    const { error } = await window.shdrSupabase.from('daily_labor').insert({
        site_id: document.getElementById('wf-site').value,
        report_date: document.getElementById('wf-date').value,
        worker_type: document.getElementById('wf-type').value,
        num_workers: num,
        daily_wage: wage,
        total_cost: num * wage,
        hours_worked: document.getElementById('wf-hours').value || '',
        created_at: new Date().toISOString(),
        created_by: currentUser.name
    });
    if (!error) {
        showToast('Worker entry logged!');
        e.target.reset();
        document.getElementById('wf-date').value = new Date().toISOString().split('T')[0];
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to save', 'error');
        btn.disabled = false;
    }
}

async function deleteWorker(id) {
    const { error } = await window.shdrSupabase.from('daily_labor').delete().eq('id', id);
    if (!error) { showToast('Deleted'); await loadAllData(); renderCurrentView(); }
    else showToast('Failed to delete', 'error');
}

// ==================== DAILY ENTRY (site manager) ====================
function renderDailyEntry() {
    const today = new Date().toISOString().split('T')[0];
    return `<div class="fade-in space-y-4 pb-24">
        <div><h1 class="text-2xl font-bold text-slate-900">Daily Entry</h1><p class="text-slate-500 text-sm">Submit today's report for ${today}</p></div>
        <form id="daily-entry-form" onsubmit="saveDailyReport(event)" class="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <select id="de-site" required class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="">Select Your Site *</option>
                ${sites.map(s => `<option value="${s.id}">${s.site_name}</option>`).join('')}
            </select>
            <div><label class="text-sm font-medium text-slate-700">Weather</label>
            <select id="de-weather" class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none mt-1">
                <option value="">Select weather</option><option>Sunny</option><option>Cloudy</option><option>Rainy</option>
            </select></div>
            <textarea id="de-progress" placeholder="Work progress..." class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none" rows="3"></textarea>
            <textarea id="de-challenges" placeholder="Challenges..." class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none" rows="2"></textarea>
            <textarea id="de-plan" placeholder="Next day plan..." class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none" rows="2"></textarea>
            <button type="submit" class="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-lg">📤 Submit Daily Report</button>
        </form>
    </div>`;
}

async function saveDailyReport(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const { error } = await window.shdrSupabase.from('daily_reports').insert({
        site_id: document.getElementById('de-site').value,
        report_date: new Date().toISOString().split('T')[0],
        weather: document.getElementById('de-weather').value,
        work_progress: document.getElementById('de-progress').value,
        challenges: document.getElementById('de-challenges').value,
        next_day_plan: document.getElementById('de-plan').value,
        is_submitted: true,
        created_at: new Date().toISOString(),
        created_by: currentUser.name
    });
    if (!error) {
        showToast('Report submitted!');
        e.target.reset();
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to submit', 'error');
        btn.disabled = false;
    }
}

// ==================== DAILY WORKERS (deployments) ====================
function renderDailyWorkers() {
    const today = new Date().toISOString().split('T')[0];
    const todayDeployments = dailyWorkerDeployments.filter(d => d.deployment_date === today);
    return `<div class="fade-in space-y-6 pb-24 lg:pb-6">
        <div><h1 class="text-2xl font-bold text-slate-900">Enterprise Workforce Management</h1></div>
        ${currentUser.role==='admin'?`<div class="flex gap-2"><button onclick="toggleWorkerDeploymentForm()" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium"><i data-lucide="plus" class="w-4 h-4"></i>New Deployment</button></div>`:''}
        <div id="worker-deployment-form"></div>
        <div class="bg-white rounded-2xl p-5 border border-slate-200">
            <h3 class="font-bold text-slate-900 mb-3">Today's Deployments (${today})</h3>
            <table class="w-full text-sm">
                <thead class="bg-slate-100 border-b"><tr><th class="px-3 py-2 text-left">Worker Type</th><th class="px-3 py-2 text-center">#</th><th class="px-3 py-2 text-right">Cost</th></tr></thead>
                <tbody>
                    ${todayDeployments.length ? todayDeployments.map(d => `<tr class="border-b"><td class="px-3 py-2">${d.worker_type}</td><td class="px-3 py-2 text-center">${d.num_workers}</td><td class="px-3 py-2 text-right font-bold text-green-600">${(d.payable_cost||0).toLocaleString()} RWF</td></tr>`).join('') : '<tr><td colspan="3" class="px-3 py-4 text-center text-slate-400">No deployments</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>`;
}

function toggleWorkerDeploymentForm() {
    const container = document.getElementById('worker-deployment-form');
    if (container.innerHTML) { container.innerHTML = ''; }
    else { renderWorkerDeploymentForm(); }
}

function renderWorkerDeploymentForm() {
    const today = new Date().toISOString().split('T')[0];
    const workerTypes = ['Mason','Assistant Mason','Carpenter','Electrician','Plumber','Welder','Painter','Steel Fixer','Driver','General Laborer','Site Supervisor'];
    const defaultWages = {'Mason':15000,'Assistant Mason':8000,'Carpenter':12000,'Welder':14000,'Electrician':16000,'Plumber':14000,'Painter':10000,'Steel Fixer':13000,'Driver':9000,'General Laborer':7000,'Site Supervisor':20000};
    document.getElementById('worker-deployment-form').innerHTML = `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h3 class="font-bold text-slate-900"><i data-lucide="users" class="w-5 h-5"></i>Create Deployment</h3>
            <div class="grid md:grid-cols-3 gap-4">
                <select id="deploy-site" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                    <option value="">Select Site *</option>
                    ${sites.map(s => `<option value="${s.id}">${s.site_name}</option>`).join('')}
                </select>
                <input id="deploy-date" type="date" required value="${today}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <input id="deploy-supervisor" placeholder="Supervisor" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                ${workerTypes.map(wt => `<label class="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer"><input type="checkbox" value="${wt}" class="deploy-worker-checkbox w-4 h-4 rounded" onchange="updateDeploymentTable('${JSON.stringify(defaultWages).replace(/"/g,'&quot;')}')"><span class="text-xs">${wt}</span></label>`).join('')}
            </div>
            <div id="deployment-table-container"></div>
            <div class="flex gap-2">
                <button type="button" onclick="saveDeploymentBatch()" class="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium">✅ Save</button>
                <button type="button" onclick="toggleWorkerDeploymentForm()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
            </div>
        </div>`;
    lucide.createIcons();
}

function updateDeploymentTable(defaultWagesJson) {
    const selected = [...document.querySelectorAll('.deploy-worker-checkbox:checked')].map(c => c.value);
    const defaultWages = JSON.parse(defaultWagesJson.replace(/&quot;/g, '"'));
    const container = document.getElementById('deployment-table-container');
    if (selected.length === 0) { container.innerHTML = ''; return; }
    let html = `<div class="border border-slate-200 rounded-lg overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-100 border-b"><tr><th class="px-3 py-2 text-left">Worker Type</th><th class="px-3 py-2 text-right"># Workers</th><th class="px-3 py-2 text-right">Daily Wage</th><th class="px-3 py-2 text-right">Total Cost</th></tr></thead><tbody>`;
    selected.forEach((wt, idx) => {
        const defaultWage = defaultWages[wt] || 10000;
        html += `<tr class="border-b hover:bg-slate-50">
            <td class="px-3 py-2 font-medium">${wt}</td>
            <td class="px-3 py-2"><input type="number" class="deploy-qty w-full px-2 py-1 rounded border text-right" min="1" value="1" data-idx="${idx}" onchange="calcDeploymentTotal()"></td>
            <td class="px-3 py-2"><input type="number" class="deploy-wage w-full px-2 py-1 rounded border text-right" min="0" value="${defaultWage}" data-idx="${idx}" onchange="calcDeploymentTotal()"></td>
            <td class="px-3 py-2 text-right"><span class="deploy-cost font-bold text-green-600" data-idx="${idx}">0</span></td>
        </tr>`;
    });
    html += `</tbody><tfoot class="bg-green-50 border-t-2 border-green-200"><tr><td colspan="3" class="px-3 py-2 font-semibold">Grand Total:</td><td class="px-3 py-2 text-right font-bold text-green-600 text-lg"><span id="deploy-grand-total">0 RWF</span></td></tr></tfoot></table></div>`;
    container.innerHTML = html;
    calcDeploymentTotal();
}

function calcDeploymentTotal() {
    let grand = 0;
    document.querySelectorAll('.deploy-qty').forEach(el => {
        const idx = el.dataset.idx;
        const qty = parseFloat(el.value) || 0;
        const wage = parseFloat(document.querySelector(`.deploy-wage[data-idx="${idx}"]`).value) || 0;
        const total = qty * wage;
        document.querySelector(`.deploy-cost[data-idx="${idx}"]`).textContent = total.toLocaleString();
        grand += total;
    });
    document.getElementById('deploy-grand-total').textContent = grand.toLocaleString() + ' RWF';
}

async function saveDeploymentBatch() {
    const siteId = document.getElementById('deploy-site').value;
    const date = document.getElementById('deploy-date').value;
    if (!siteId) { showToast('Select a site', 'error'); return; }
    const selected = [...document.querySelectorAll('.deploy-worker-checkbox:checked')].map(c => c.value);
    const rows = [];
    document.querySelectorAll('.deploy-qty').forEach((el, idx) => {
        const qty = parseFloat(el.value) || 0;
        if (qty === 0) return;
        const wage = parseFloat(document.querySelector(`.deploy-wage[data-idx="${idx}"]`).value) || 0;
        rows.push({
            worker_id: null,
            site_id: siteId,
            deployment_date: date,
            deployment_status: 'Active',
            supervisor_name: document.getElementById('deploy-supervisor').value,
            worker_type: selected[idx],
            num_workers: qty,
            daily_wage: wage,
            payable_cost: qty * wage,
            created_at: new Date().toISOString(),
            created_by: currentUser.name
        });
    });
    if (rows.length === 0) { showToast('Add at least one type', 'error'); return; }
    const { error } = await window.shdrSupabase.from('worker_deployments').insert(rows);
    if (!error) {
        showToast('Deployment saved!');
        document.getElementById('worker-deployment-form').innerHTML = '';
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to save', 'error');
    }
}

// ==================== SUPPLIERS ====================
function renderSuppliers() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Supplier Management</h1>
            <button onclick="document.getElementById('supplier-form').classList.toggle('hidden')" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i>Add Supplier</button>
        </div>
        <form id="supplier-form" class="hidden bg-white rounded-2xl p-5 border border-slate-200 space-y-3" onsubmit="saveSupplier(event)">
            <input id="sup-name" placeholder="Supplier Name *" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <div class="grid grid-cols-2 gap-3">
                <input id="sup-contact" placeholder="Contact Person" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <input id="sup-phone" placeholder="Phone" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            </div>
            <input id="sup-email" type="email" placeholder="Email" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <button type="submit" class="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium">Save Supplier</button>
        </form>
        <div class="grid gap-3">
            ${suppliers.length ? suppliers.map(s => `<div class="bg-white rounded-2xl p-4 border border-slate-200"><h3 class="font-semibold">${s.supplier_name}</h3><p class="text-sm text-slate-500">${s.supplier_phone||''}</p></div>`).join('') : '<p class="text-slate-400">No suppliers</p>'}
        </div>
    </div>`;
}

async function saveSupplier(e) {
    e.preventDefault();
    const { error } = await window.shdrSupabase.from('suppliers').insert({
        supplier_name: document.getElementById('sup-name').value,
        supplier_contact: document.getElementById('sup-contact').value,
        supplier_phone: document.getElementById('sup-phone').value,
        supplier_email: document.getElementById('sup-email').value,
        created_at: new Date().toISOString()
    });
    if (!error) {
        showToast('Supplier added!');
        document.getElementById('supplier-form').classList.add('hidden');
        e.target.reset();
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to add', 'error');
    }
}

// ==================== PURCHASE ORDERS ====================
function renderPurchaseOrders() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Purchase Orders</h1>
            <button onclick="togglePOForm()" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="plus" class="w-4 h-4"></i>Create PO</button>
        </div>
        <div id="po-form-container"></div>
        <div class="bg-white rounded-2xl p-5 border border-slate-200 overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-slate-100 border-b"><tr><th class="px-3 py-2 text-left">PO #</th><th class="px-3 py-2 text-left">Supplier</th><th class="px-3 py-2 text-left">Order Date</th><th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2 text-center">Status</th></tr></thead>
                <tbody>
                    ${purchaseOrders.length ? purchaseOrders.slice().reverse().map(p => `<tr class="border-b"><td class="px-3 py-2">${p.po_number||p.po_code}</td><td class="px-3 py-2">${p.supplier_id}</td><td class="px-3 py-2">${p.order_date}</td><td class="px-3 py-2 text-right font-bold text-green-600">${(p.po_total||0).toLocaleString()} RWF</td><td class="px-3 py-2 text-center"><span class="px-2 py-1 rounded-full text-xs font-medium ${p.po_status==='pending'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}">${p.po_status}</span></td></tr>`).join('') : '<tr><td colspan="5" class="text-center py-4 text-slate-400">No purchase orders</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>`;
}

function togglePOForm() {
    const container = document.getElementById('po-form-container');
    if (container.innerHTML) { container.innerHTML = ''; }
    else { renderPOForm(); }
}

function renderPOForm() {
    document.getElementById('po-form-container').innerHTML = `
        <form onsubmit="savePO(event)" class="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h3 class="font-semibold text-slate-900">Create Purchase Order</h3>
            <select id="po-supplier" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="">Select Supplier *</option>
                ${suppliers.map(s => `<option value="${s.id}">${s.supplier_name}</option>`).join('')}
            </select>
            <input id="po-date" type="date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <input id="po-delivery" type="date" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <input id="po-amount" type="number" min="0" required placeholder="Amount (RWF)" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <textarea id="po-description" placeholder="Items description..." class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none" rows="2"></textarea>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium">📤 Create PO</button>
                <button type="button" onclick="togglePOForm()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
            </div>
        </form>`;
}

async function savePO(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const poCode = 'PO-' + String(purchaseOrders.length + 1).padStart(5, '0');
    const { error } = await window.shdrSupabase.from('purchase_orders').insert({
        po_number: poCode,
        po_code: poCode,
        supplier_id: document.getElementById('po-supplier').value,
        order_date: document.getElementById('po-date').value,
        delivery_date: document.getElementById('po-delivery').value,
        po_total: parseFloat(document.getElementById('po-amount').value || 0),
        po_description: document.getElementById('po-description').value,
        po_status: 'pending',
        created_at: new Date().toISOString(),
        created_by: currentUser.name
    });
    if (!error) {
        showToast('PO created: ' + poCode);
        document.getElementById('po-form-container').innerHTML = '';
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to create PO', 'error');
        btn.disabled = false;
    }
}

// ==================== PHOTOS ====================
function renderPhotos() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <div class="flex justify-between items-center">
            <h1 class="text-2xl font-bold text-slate-900">Site Photos</h1>
            <button onclick="togglePhotoUpload()" class="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"><i data-lucide="camera" class="w-4 h-4"></i>Capture Photo</button>
        </div>
        <div id="photo-upload-container"></div>
        <div class="grid md:grid-cols-3 gap-4">
            ${photos.length ? photos.slice().reverse().map(p => `<div class="bg-white rounded-2xl overflow-hidden border border-slate-200 card-hover">
                <div class="h-40 bg-slate-100 flex items-center justify-center"><i data-lucide="image" class="w-8 h-8 text-slate-400"></i></div>
                <div class="p-3">
                    <h4 class="font-semibold text-sm">${p.photo_site}</h4>
                    <p class="text-xs text-slate-500">${p.photo_date}</p>
                    <p class="text-xs text-slate-600 mt-2">${p.photo_description||''}</p>
                </div>
            </div>`).join('') : '<div class="col-span-full text-center py-12"><i data-lucide="camera" class="w-12 h-12 text-slate-200 mx-auto"></i><p class="text-slate-400">No photos yet</p></div>'}
        </div>
    </div>`;
}

function togglePhotoUpload() {
    const container = document.getElementById('photo-upload-container');
    if (container.innerHTML) { container.innerHTML = ''; }
    else { renderPhotoUpload(); }
}

function renderPhotoUpload() {
    document.getElementById('photo-upload-container').innerHTML = `
        <form onsubmit="savePhoto(event)" class="bg-white rounded-2xl p-5 border border-slate-200 space-y-4">
            <h3 class="font-semibold text-slate-900"><i data-lucide="camera" class="w-5 h-5"></i>Capture Site Progress Photo</h3>
            <select id="photo-site" required class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                <option value="">Select Site *</option>
                ${sites.map(s => `<option value="${s.id}">${s.site_name}</option>`).join('')}
            </select>
            <input id="photo-date" type="date" required value="${new Date().toISOString().split('T')[0]}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none">
            <textarea id="photo-description" placeholder="Description..." class="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none" rows="2"></textarea>
            <div class="flex gap-2">
                <button type="submit" class="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium">💾 Save Photo Record</button>
                <button type="button" onclick="togglePhotoUpload()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium">Cancel</button>
            </div>
        </form>`;
}

async function savePhoto(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const siteId = document.getElementById('photo-site').value;
    const siteName = sites.find(s => s.id == siteId)?.site_name || '';
    const { error } = await window.shdrSupabase.from('site_photos').insert({
        site_id: siteId,
        photo_date: document.getElementById('photo-date').value,
        photo_site: siteName,
        photo_description: document.getElementById('photo-description').value,
        created_at: new Date().toISOString(),
        created_by: currentUser.name
    });
    if (!error) {
        showToast('Photo record saved!');
        document.getElementById('photo-upload-container').innerHTML = '';
        await loadAllData();
        renderCurrentView();
    } else {
        showToast('Failed to save', 'error');
        btn.disabled = false;
    }
}

// ==================== REPORTS ====================
function renderReports() {
    return `<div class="fade-in space-y-6 pb-20 lg:pb-0">
        <h1 class="text-2xl font-bold text-slate-900">Reports</h1>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button onclick="exportCSV()" class="p-4 bg-white rounded-xl border border-slate-200 text-sm font-medium">📊 Export CSV</button>
            <button onclick="generatePDF()" class="p-4 bg-white rounded-xl border border-slate-200 text-sm font-medium">📄 Export PDF</button>
        </div>
    </div>`;
}

function exportCSV() {
    let csv = 'SHDR Ltd Report\nMaterials\n';
    materials.forEach(m => csv += `${m.material_name},${m.quantity},${m.unit},${m.total_material_cost}\n`);
    csv += '\nWorkers\n';
    workers.forEach(w => csv += `${w.worker_type},${w.num_workers},${w.total_cost}\n`);
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report.csv';
    a.click();
    showToast('CSV exported!');
}

function generatePDF() {
    const element = document.createElement('div');
    element.innerHTML = '<h1>SHDR Report</h1><p>Generated on ' + new Date().toLocaleDateString() + '</p>';
    html2pdf().set({margin:10,filename:'report.pdf'}).from(element).save();
    showToast('PDF generated!');
}

// ==================== AUDIT LOGS ====================
function renderAuditLogs() {
    return `<div class="fade-in space-y-4 pb-20 lg:pb-0">
        <h1 class="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <div class="bg-white rounded-2xl p-5 border border-slate-200 overflow-x-auto">
            <table class="w-full text-sm">
                <thead class="bg-slate-100 border-b"><tr><th class="px-3 py-2 text-left">Timestamp</th><th class="px-3 py-2 text-left">User</th><th class="px-3 py-2 text-left">Action</th><th class="px-3 py-2 text-left">Details</th></tr></thead>
                <tbody>
                    ${auditLogs.length ? auditLogs.slice().reverse().slice(0,50).map(log => `<tr class="border-b"><td class="px-3 py-2 text-xs">${log.audit_timestamp||''}</td><td class="px-3 py-2 font-medium">${log.audit_user||'System'}</td><td class="px-3 py-2"><span class="px-2 py-1 bg-slate-100 rounded text-xs">${log.audit_action}</span></td><td class="px-3 py-2 text-xs">${log.audit_details||''}</td></tr>`).join('') : '<tr><td colspan="4" class="text-center py-4 text-slate-400">No logs</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>`;
}
