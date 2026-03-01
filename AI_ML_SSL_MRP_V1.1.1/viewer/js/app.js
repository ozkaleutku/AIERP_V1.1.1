// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderSidebar();

    // Check URL params for initial page
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const group = params.get('group');

    if (page && group) {
        loadPage(group, page);
    } else {
        // Default to Home (Ana_Sayfa) or first available
        loadPage('sistem_genel_bakis', 'MIMARI_YAKLASIM');
    }

    // Initialize Mermaid
    mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose'
    });
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Re-render mermaid diagrams if any
    const mermaidDivs = document.querySelectorAll('.mermaid');
    if (mermaidDivs.length > 0) {
        location.reload(); // Simplest way to re-render mermaid with new theme
    }
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Sidebar Rendering
function renderSidebar() {
    const navContainer = document.getElementById('nav-container');
    navContainer.innerHTML = '';

    const groups = {
        'sistem_genel_bakis': 'Sistem Vizyonu',
        'yapay_zeka_ve_algoritmalar': 'Akıllı Emniyet Optimizasyonu',
        'operasyonel_kilavuz': 'Operasyon Merkezi'
    };

    for (const [key, label] of Object.entries(groups)) {
        if (docData[key] && Object.keys(docData[key]).length > 0) {
            const groupDiv = document.createElement('div');
            groupDiv.innerHTML = `<div class="nav-group-title">${label}</div>`;

            Object.keys(docData[key]).sort().forEach(filename => {
                const item = document.createElement('a');
                item.className = 'nav-item';
                item.textContent = filename.replace(/_/g, ' ');
                item.onclick = () => loadPage(key, filename);
                item.dataset.group = key;
                item.dataset.page = filename;
                groupDiv.appendChild(item);
            });

            navContainer.appendChild(groupDiv);
        }
    }
}

// Page Loading
function loadPage(group, filename) {
    const content = docData[group][filename];
    if (!content) return;

    // Update active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[data-group="${group}"][data-page="${filename}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');

    // Handle Special Cases
    if (filename === 'DATABASE_SCHEMA') {
        renderDatabaseSchema(content);
        return;
    }

    // Convert Markdown to HTML
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = marked.parse(content);

    // Render Mermaid
    renderMermaid();

    // Highlight Code
    hljs.highlightAll();

    // Scroll to top
    document.getElementById('main').scrollTop = 0;
}

function renderDatabaseSchema(content) {
    const contentDiv = document.getElementById('content');

    // Create a special header and link to the graph view
    const html = marked.parse(content);

    // Inject the button before the first mermaid diagram or at the top
    const buttonHtml = `
        <div style="margin: 20px 0; padding: 20px; background-color: var(--sidebar-bg); border-radius: 8px; border: 1px solid var(--border-color);">
            <h3>📊 Interactive Database Graph</h3>
            <p>The database schema diagram is very large. View it in the interactive explorer.</p>
            <a href="sql_graph.html" class="sql-graph-link">Open Interactive Graph View ↗</a>
        </div>
    `;

    contentDiv.innerHTML = buttonHtml + html;

    renderMermaid();
    hljs.highlightAll();
    document.getElementById('main').scrollTop = 0;
}

async function renderMermaid() {
    const mermaidDivs = document.querySelectorAll('.mermaid');

    // First pass: Convert code blocks to div.mermaid if they haven't been processed
    const codeBlocks = document.querySelectorAll('pre code.language-mermaid');
    codeBlocks.forEach(block => {
        const pre = block.parentElement;
        const div = document.createElement('div');
        div.className = 'mermaid';

        // Strip out any hardcoded theme initialization to respect our UI theme
        let content = block.textContent;
        content = content.replace(/%%\{init:.*\}%%/g, '');

        div.textContent = content;
        pre.replaceWith(div);
    });

    // Run mermaid on all .mermaid elements
    try {
        await mermaid.run({
            nodes: document.querySelectorAll('.mermaid')
        });
    } catch (e) {
        console.error('Mermaid error:', e);
        // Fallback for failed diagrams
        document.querySelectorAll('.mermaid[data-processed="true"]').forEach(div => {
            if (div.innerHTML === '') {
                div.innerHTML = `<div style="color:red; border:1px solid red; padding:10px;">
                    Failed to render flowchart. Syntax error or incompatibility.
                    <pre>${div.textContent}</pre>
                </div>`;
            }
        });
    }
}
