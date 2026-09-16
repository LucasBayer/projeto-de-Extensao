const CITIES = ["Camaquã", "Sentinela do Sul", "Tapes", "Sertão Santana"];

let providers = JSON.parse(localStorage.getItem('cs_providers')) || [
  { id: 1, nome: "João Pereira", profissao: "Eletricista", cidade: "Tapes", preco: 90, contato: "(51) 90000-0001",
    descricao: "Instalações elétricas residenciais e comerciais, com mais de 10 anos de experiência.",
    foto: "", rating: 4.8, avaliacoes: 24, requisicoes: 58 },
  { id: 2, nome: "Marcia Souza", profissao: "Professora Particular", cidade: "Camaquã", preco: 60, contato: "(51) 90000-0002",
    descricao: "Aulas de reforço em matemática e física para ensino fundamental e médio.",
    foto: "", rating: 4.9, avaliacoes: 31, requisicoes: 72 },
  { id: 3, nome: "Carlos Mendes", profissao: "Encanador", cidade: "Sertão Santana", preco: 75, contato: "(51) 90000-0003",
    descricao: "Reparos hidráulicos, desentupimentos e instalação de encanamentos.",
    foto: "", rating: 4.5, avaliacoes: 18, requisicoes: 40 },
  { id: 4, nome: "Ana Rodrigues", profissao: "Manicure", cidade: "Sentinela do Sul", preco: 35, contato: "(51) 90000-0004",
    descricao: "Atendimento a domicílio, unhas em gel e esmaltação em gel.",
    foto: "", rating: 4.7, avaliacoes: 45, requisicoes: 90 },
  { id: 5, nome: "Pedro Almeida", profissao: "Mecânico", cidade: "Camaquã", preco: 120, contato: "(51) 90000-0005",
    descricao: "Manutenção geral, troca de óleo e revisão de veículos leves.",
    foto: "", rating: 4.6, avaliacoes: 22, requisicoes: 50 },
  { id: 6, nome: "Fernanda Lima", profissao: "Dentista", cidade: "Tapes", preco: 150, contato: "(51) 90000-0006",
    descricao: "Consultas, limpeza e tratamentos odontológicos gerais.",
    foto: "", rating: 5.0, avaliacoes: 12, requisicoes: 25 },
];

let historico = JSON.parse(localStorage.getItem('cs_historico')) || [
  { id: 1, providerId: 1, providerNome: "João Pereira", servico: "Eletricista", data: "02/07/2026", status: "concluido", avaliado: false },
  { id: 2, providerId: 4, providerNome: "Ana Rodrigues", servico: "Manicure", data: "20/07/2026", status: "avaliado", avaliado: true },
  { id: 3, providerId: 3, providerNome: "Carlos Mendes", servico: "Encanador", data: "10/08/2026", status: "andamento", avaliado: false },
];

let currentUser = JSON.parse(localStorage.getItem('cs_currentUser')) || null;
let reviewTargetHistoryId = null;
let selectedStars = 0;

function saveState() {
  localStorage.setItem('cs_providers', JSON.stringify(providers));
  localStorage.setItem('cs_historico', JSON.stringify(historico));
}

/* ---------- NAVEGAÇÃO ---------- */
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector('.header').classList.remove('header--open');

  if (pageId === 'busca') renderResults();
  if (pageId === 'perfil') renderMyServices();
  if (pageId === 'historico') renderHistory();
  if (pageId === 'home') { renderFeatured(); renderCategoryChips(); }
}

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) navigate(nav.dataset.nav);
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.querySelector('.header').classList.toggle('header--open');
});

/* ---------- CARD TEMPLATE ---------- */
function starsHtml(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function cardTemplate(p) {
  const photoStyle = p.foto ? `style="background-image:url('${p.foto}')"` : '';
  const initials = p.foto ? '' : p.nome.charAt(0);
  return `
  <div class="card">
    <div class="card__photo" ${photoStyle}>${initials}</div>
    <div class="card__body">
      <div class="card__name">${p.nome}</div>
      <div class="card__profession">${p.profissao}</div>
      <div class="card__city">📍 ${p.cidade}</div>
      <div class="card__rating">${starsHtml(p.rating)} (${p.avaliacoes})</div>
      <div class="card__price">R$ ${p.preco.toFixed(2)}</div>
    </div>
    <div class="card__actions">
      <button class="btn btn--secondary" style="margin-top:0" onclick="openProviderModal(${p.id})">Ver perfil</button>
      <button class="btn btn--accent" onclick="window.open('https://wa.me/55${p.contato.replace(/\\D/g,'')}','_blank')">Contato</button>
    </div>
  </div>`;
}

function renderFeatured() {
  const top = [...providers].sort((a, b) => b.requisicoes - a.requisicoes).slice(0, 3);
  document.getElementById('featuredGrid').innerHTML = top.map(cardTemplate).join('');
}

function renderCategoryChips() {
  const professions = [...new Set(providers.map(p => p.profissao))];
  document.getElementById('categoryChips').innerHTML = professions.map(prof =>
    `<span class="chip" onclick="goToSearchWithProfession('${prof}')">${prof}</span>`).join('');
}

function goToSearchWithProfession(prof) {
  navigate('busca');
  document.getElementById('filterProfession').value = prof;
  renderResults();
}

/* ---------- MODAL PERFIL PRESTADOR ---------- */
function openProviderModal(id) {
  const p = providers.find(x => x.id === id);
  if (!p) return;
  document.getElementById('providerModalContent').innerHTML = `
    <h3>${p.nome}</h3>
    <p><strong>${p.profissao}</strong> · ${p.cidade}</p>
    <p class="card__rating">${starsHtml(p.rating)} (${p.avaliacoes} avaliações)</p>
    <p style="margin:12px 0;">${p.descricao || 'Sem descrição informada.'}</p>
    <p><strong>Preço médio:</strong> R$ ${p.preco.toFixed(2)}</p>
    <p><strong>Contato:</strong> ${p.contato}</p>
    <button class="btn btn--accent btn--block" onclick="window.open('https://wa.me/55${p.contato.replace(/\\D/g,'')}','_blank')">Chamar no WhatsApp</button>
  `;
  document.getElementById('providerModal').classList.remove('hidden');
}
document.getElementById('closeProviderModal').addEventListener('click', () =>
  document.getElementById('providerModal').classList.add('hidden'));

/* ---------- BUSCA / FILTROS ---------- */
function populateProfessionFilter() {
  const select = document.getElementById('filterProfession');
  const professions = [...new Set(providers.map(p => p.profissao))];
  select.innerHTML = '<option value="">Todas</option>' + professions.map(p => `<option>${p}</option>`).join('');
}

function renderResults() {
  const keyword = document.getElementById('filterKeyword').value.toLowerCase();
  const city = document.getElementById('filterCity').value;
  const profession = document.getElementById('filterProfession').value;
  const maxPrice = Number(document.getElementById('filterPrice').value);
  const sort = document.getElementById('filterSort').value;

  let filtered = providers.filter(p =>
    (p.nome.toLowerCase().includes(keyword) || p.profissao.toLowerCase().includes(keyword)) &&
    (!city || p.cidade === city) &&
    (!profession || p.profissao === profession) &&
    (p.preco <= maxPrice)
  );

  if (sort === 'preco-asc') filtered.sort((a, b) => a.preco - b.preco);
  else if (sort === 'preco-desc') filtered.sort((a, b) => b.preco - a.preco);
  else if (sort === 'avaliacao') filtered.sort((a, b) => b.rating - a.rating);
  else filtered.sort((a, b) => b.requisicoes - a.requisicoes);

  document.getElementById('resultsCount').textContent = `${filtered.length} prestador(es) encontrado(s)`;
  document.getElementById('resultsGrid').innerHTML = filtered.length
    ? filtered.map(cardTemplate).join('')
    : '<p>Nenhum prestador encontrado com esses filtros.</p>';
}

['filterKeyword', 'filterCity', 'filterProfession', 'filterSort'].forEach(id =>
  document.getElementById(id).addEventListener('input', renderResults));

document.getElementById('filterPrice').addEventListener('input', (e) => {
  document.getElementById('priceValue').textContent = `R$ ${e.target.value}`;
  renderResults();
});

document.getElementById('clearFilters').addEventListener('click', () => {
  document.getElementById('filterKeyword').value = '';
  document.getElementById('filterCity').value = '';
  document.getElementById('filterProfession').value = '';
  document.getElementById('filterPrice').value = 500;
  document.getElementById('priceValue').textContent = 'R$ 500';
  document.getElementById('filterSort').value = 'relevancia';
  renderResults();
});

document.getElementById('heroSearchBtn').addEventListener('click', () => {
  navigate('busca');
  document.getElementById('filterKeyword').value = document.getElementById('heroSearchInput').value;
  document.getElementById('filterCity').value = document.getElementById('heroCitySelect').value;
  renderResults();
});

/* ---------- LOGIN ---------- */
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  currentUser = { email, nome: email.split('@')[0] };
  localStorage.setItem('cs_currentUser', JSON.stringify(currentUser));
  document.getElementById('loginMsg').style.color = '#2e7d32';
  document.getElementById('loginMsg').textContent = 'Login realizado com sucesso! Redirecionando...';
  setTimeout(() => navigate('home'), 900);
});

/* ---------- CADASTRO ---------- */
document.getElementById('registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const tipo = document.querySelector('input[name="tipoConta"]:checked').value;
  currentUser = {
    nome: document.getElementById('regNome').value,
    cidade: document.getElementById('regCidade').value,
    email: document.getElementById('regEmail').value,
    telefone: document.getElementById('regTelefone').value,
    tipo
  };
  localStorage.setItem('cs_currentUser', JSON.stringify(currentUser));
  document.getElementById('regMsg').style.color = '#2e7d32';
  document.getElementById('regMsg').textContent = 'Cadastro realizado com sucesso!';
  setTimeout(() => navigate(tipo === 'prestador' ? 'perfil' : 'home'), 900);
});

/* ---------- PAINEL DO PRESTADOR ---------- */
document.getElementById('providerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const novo = {
    id: Date.now(),
    nome: document.getElementById('pNome').value,
    profissao: document.getElementById('pProfissao').value,
    cidade: document.getElementById('pCidade').value,
    preco: Number(document.getElementById('pPreco').value),
    contato: document.getElementById('pContato').value,
    descricao: document.getElementById('pDescricao').value,
    foto: document.getElementById('pFoto').value,
    rating: 0, avaliacoes: 0, requisicoes: 0
  };
  providers.push(novo);
  saveState();
  populateProfessionFilter();
  document.getElementById('providerMsg').style.color = '#2e7d32';
  document.getElementById('providerMsg').textContent = 'Serviço publicado com sucesso!';
  document.getElementById('providerForm').reset();
  renderMyServices();
});

function renderMyServices() {
  const recent = [...providers].slice(-4).reverse();
  document.getElementById('myServicesGrid').innerHTML = recent.length
    ? recent.map(cardTemplate).join('')
    : '<p>Você ainda não publicou nenhum serviço.</p>';
}

/* ---------- HISTÓRICO ---------- */
function renderHistory() {
  document.getElementById('historyList').innerHTML = historico.map(h => `
    <div class="history-item">
      <div class="history-item__info">
        <h4>${h.servico} — ${h.providerNome}</h4>
        <p>Solicitado em ${h.data}</p>
      </div>
      <span class="status status--${h.status}">${
        h.status === 'concluido' ? 'Concluído' : h.status === 'andamento' ? 'Em andamento' : 'Avaliado'
      }</span>
      ${h.status === 'concluido' ? `<button class="btn btn--accent" onclick="openReviewModal(${h.id})">Avaliar</button>` : ''}
    </div>
  `).join('');
}

function openReviewModal(historyId) {
  reviewTargetHistoryId = historyId;
  selectedStars = 0;
  document.querySelectorAll('#starInput span').forEach(s => s.classList.remove('active'));
  document.getElementById('reviewComment').value = '';
  const item = historico.find(h => h.id === historyId);
  document.getElementById('reviewProviderName').textContent = `${item.providerNome} — ${item.servico}`;
  document.getElementById('reviewModal').classList.remove('hidden');
}
document.getElementById('closeReviewModal').addEventListener('click', () =>
  document.getElementById('reviewModal').classList.add('hidden'));

document.querySelectorAll('#starInput span').forEach(star => {
  star.addEventListener('click', () => {
    selectedStars = Number(star.dataset.value);
    document.querySelectorAll('#starInput span').forEach(s =>
      s.classList.toggle('active', Number(s.dataset.value) <= selectedStars));
  });
});

document.getElementById('submitReview').addEventListener('click', () => {
  if (!selectedStars) { alert('Selecione uma nota de 1 a 5 estrelas.'); return; }
  const item = historico.find(h => h.id === reviewTargetHistoryId);
  if (item) {
    item.status = 'avaliado';
    item.avaliado = true;
    const provider = providers.find(p => p.id === item.providerId);
    if (provider) {
      const totalPontos = provider.rating * provider.avaliacoes + selectedStars;
      provider.avaliacoes += 1;
      provider.rating = Number((totalPontos / provider.avaliacoes).toFixed(1));
    }
  }
  saveState();
  document.getElementById('reviewModal').classList.add('hidden');
  renderHistory();
});

/* ---------- INIT ---------- */
populateProfessionFilter();
renderFeatured();
renderCategoryChips();