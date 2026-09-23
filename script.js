/* =========================================================
   CONECTA SERVIÇOS — FRONT-END conectado à API (Node + PostgreSQL)
   Todos os dados vêm do back-end via fetch(). Nada é mais estático.
========================================================= */

const API = '/api'; // mesmo domínio/porta do servidor Express

let currentUser = JSON.parse(localStorage.getItem('cs_currentUser')) || null;
let reviewTargetHistoryId = null;
let reviewTargetProviderId = null;
let selectedStars = 0;

/* ---------- HELPER DE REQUISIÇÃO ---------- */
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro na requisição.');
  return data;
}

/* ---------- NAVEGAÇÃO ---------- */
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelector('.header').classList.remove('header--open');

  if (pageId === 'busca') { populateProfessionFilter(); renderResults(); }
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
  const full = Math.round(Number(rating) || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function cardTemplate(p) {
  const photoStyle = p.foto_url ? `style="background-image:url('${p.foto_url}')"` : '';
  const initials = p.foto_url ? '' : p.nome.charAt(0);
  return `
  <div class="card">
    <div class="card__photo" ${photoStyle}>${initials}</div>
    <div class="card__body">
      <div class="card__name">${p.nome}</div>
      <div class="card__profession">${p.profissao}</div>
      <div class="card__city">📍 ${p.cidade}</div>
      <div class="card__rating">${starsHtml(p.rating)} (${p.avaliacoes})</div>
      <div class="card__price">R$ ${Number(p.preco).toFixed(2)}</div>
    </div>
    <div class="card__actions">
      <button class="btn btn--secondary" style="margin-top:0" onclick="openProviderModal(${p.id})">Ver perfil</button>
      <button class="btn btn--accent" onclick="contatarPrestador(${p.id}, '${p.contato}', '${p.profissao.replace(/'/g, "")}')">Contato</button>
    </div>
  </div>`;
}

async function contatarPrestador(prestadorId, contato, servico) {
  if (currentUser) {
    try {
      await api('/historico', {
        method: 'POST',
        body: JSON.stringify({ usuario_id: currentUser.id, prestador_id: prestadorId, servico }),
      });
    } catch (err) { console.warn('Não foi possível registrar no histórico:', err.message); }
  }
  window.open(`https://wa.me/55${contato.replace(/\D/g, '')}`, '_blank');
}

/* ---------- HOME ---------- */
async function renderFeatured() {
  try {
    const prestadores = await api('/prestadores?ordenar=relevancia');
    document.getElementById('featuredGrid').innerHTML = prestadores.slice(0, 3).map(cardTemplate).join('');
  } catch (err) {
    document.getElementById('featuredGrid').innerHTML = `<p>Não foi possível carregar prestadores (${err.message}).</p>`;
  }
}

async function renderCategoryChips() {
  try {
    const professions = await api('/profissoes');
    document.getElementById('categoryChips').innerHTML = professions.map(prof =>
      `<span class="chip" onclick="goToSearchWithProfession('${prof}')">${prof}</span>`).join('');
  } catch (err) { console.warn(err); }
}

function goToSearchWithProfession(prof) {
  navigate('busca');
  setTimeout(() => {
    document.getElementById('filterProfession').value = prof;
    renderResults();
  }, 50);
}

/* ---------- MODAL PERFIL PRESTADOR ---------- */
async function openProviderModal(id) {
  try {
    const p = await api(`/prestadores/${id}`);
    const comentariosHtml = p.comentarios.length
      ? p.comentarios.map(c => `<p style="margin-top:8px;"><strong>${c.autor}</strong>: ${starsHtml(c.nota)}<br>${c.comentario || ''}</p>`).join('')
      : '<p style="opacity:.7;">Ainda sem comentários.</p>';

    document.getElementById('providerModalContent').innerHTML = `
      <h3>${p.nome}</h3>
      <p><strong>${p.profissao}</strong> · ${p.cidade}</p>
      <p class="card__rating">${starsHtml(p.rating)} (${p.avaliacoes} avaliações)</p>
      <p style="margin:12px 0;">${p.descricao || 'Sem descrição informada.'}</p>
      <p><strong>Preço médio:</strong> R$ ${Number(p.preco).toFixed(2)}</p>
      <p><strong>Contato:</strong> ${p.contato}</p>
      <button class="btn btn--accent btn--block" onclick="contatarPrestador(${p.id}, '${p.contato}', '${p.profissao}')">Chamar no WhatsApp</button>
      <hr style="margin:14px 0;">
      <h4>Avaliações</h4>
      ${comentariosHtml}
    `;
    document.getElementById('providerModal').classList.remove('hidden');
  } catch (err) {
    alert('Erro ao carregar perfil: ' + err.message);
  }
}
document.getElementById('closeProviderModal').addEventListener('click', () =>
  document.getElementById('providerModal').classList.add('hidden'));

/* ---------- BUSCA / FILTROS ---------- */
async function populateProfessionFilter() {
  const select = document.getElementById('filterProfession');
  const atual = select.value;
  try {
    const professions = await api('/profissoes');
    select.innerHTML = '<option value="">Todas</option>' + professions.map(p => `<option>${p}</option>`).join('');
    select.value = atual;
  } catch (err) { console.warn(err); }
}

async function renderResults() {
  const busca = document.getElementById('filterKeyword').value;
  const cidade = document.getElementById('filterCity').value;
  const profissao = document.getElementById('filterProfession').value;
  const precoMax = document.getElementById('filterPrice').value;
  const ordenar = document.getElementById('filterSort').value;

  const params = new URLSearchParams({ busca, cidade, profissao, precoMax, ordenar });
  document.getElementById('resultsCount').textContent = 'Carregando...';

  try {
    const prestadores = await api('/prestadores?' + params.toString());
    document.getElementById('resultsCount').textContent = `${prestadores.length} prestador(es) encontrado(s)`;
    document.getElementById('resultsGrid').innerHTML = prestadores.length
      ? prestadores.map(cardTemplate).join('')
      : '<p>Nenhum prestador encontrado com esses filtros.</p>';
  } catch (err) {
    document.getElementById('resultsCount').textContent = '';
    document.getElementById('resultsGrid').innerHTML = `<p>Erro ao buscar: ${err.message}</p>`;
  }
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
  setTimeout(() => {
    document.getElementById('filterKeyword').value = document.getElementById('heroSearchInput').value;
    document.getElementById('filterCity').value = document.getElementById('heroCitySelect').value;
    renderResults();
  }, 50);
});

/* ---------- LOGIN ---------- */
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const senha = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');
  try {
    const usuario = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
    currentUser = usuario;
    localStorage.setItem('cs_currentUser', JSON.stringify(currentUser));
    msg.style.color = '#2e7d32';
    msg.textContent = 'Login realizado com sucesso! Redirecionando...';
    setTimeout(() => navigate('home'), 800);
  } catch (err) {
    msg.style.color = '#c62828';
    msg.textContent = err.message;
  }
});

/* ---------- CADASTRO ---------- */
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tipo = document.querySelector('input[name="tipoConta"]:checked').value;
  const msg = document.getElementById('regMsg');
  const payload = {
    nome: document.getElementById('regNome').value,
    cidade: document.getElementById('regCidade').value,
    email: document.getElementById('regEmail').value,
    telefone: document.getElementById('regTelefone').value,
    senha: document.getElementById('regSenha').value,
    tipo,
  };
  try {
    const usuario = await api('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    currentUser = usuario;
    localStorage.setItem('cs_currentUser', JSON.stringify(currentUser));
    msg.style.color = '#2e7d32';
    msg.textContent = 'Cadastro realizado com sucesso!';
    setTimeout(() => navigate(tipo === 'prestador' ? 'perfil' : 'home'), 800);
  } catch (err) {
    msg.style.color = '#c62828';
    msg.textContent = err.message;
  }
});

/* ---------- PAINEL DO PRESTADOR ---------- */
document.getElementById('providerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('providerMsg');
  if (!currentUser) {
    msg.style.color = '#c62828';
    msg.textContent = 'Você precisa estar logado para publicar um serviço.';
    return;
  }
  const payload = {
    usuario_id: currentUser.id,
    nome: document.getElementById('pNome').value,
    profissao: document.getElementById('pProfissao').value,
    cidade: document.getElementById('pCidade').value,
    preco: Number(document.getElementById('pPreco').value),
    contato: document.getElementById('pContato').value,
    descricao: document.getElementById('pDescricao').value,
    foto_url: document.getElementById('pFoto').value,
  };
  try {
    await api('/prestadores', { method: 'POST', body: JSON.stringify(payload) });
    msg.style.color = '#2e7d32';
    msg.textContent = 'Serviço publicado com sucesso!';
    document.getElementById('providerForm').reset();
    renderMyServices();
  } catch (err) {
    msg.style.color = '#c62828';
    msg.textContent = err.message;
  }
});

async function renderMyServices() {
  const grid = document.getElementById('myServicesGrid');
  if (!currentUser) {
    grid.innerHTML = '<p>Faça login para ver seus serviços publicados.</p>';
    return;
  }
  try {
    const meus = await api(`/prestadores/usuario/${currentUser.id}`);
    grid.innerHTML = meus.length ? meus.map(p => cardTemplate({ ...p, rating: 0, avaliacoes: 0 })).join('') : '<p>Você ainda não publicou nenhum serviço.</p>';
  } catch (err) {
    grid.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

/* ---------- HISTÓRICO ---------- */
async function renderHistory() {
  const list = document.getElementById('historyList');
  if (!currentUser) {
    list.innerHTML = '<p>Faça login para ver seu histórico de serviços.</p>';
    return;
  }
  try {
    const historico = await api(`/historico/${currentUser.id}`);
    list.innerHTML = historico.length ? historico.map(h => `
      <div class="history-item">
        <div class="history-item__info">
          <h4>${h.servico || 'Serviço'} — ${h.prestador_nome}</h4>
          <p>Solicitado em ${new Date(h.data_solicitacao).toLocaleDateString('pt-BR')}</p>
        </div>
        <span class="status status--${h.status}">${
          h.status === 'concluido' ? 'Concluído' : h.status === 'andamento' ? 'Em andamento' : 'Avaliado'
        }</span>
        ${h.status === 'concluido' ? `<button class="btn btn--accent" onclick="openReviewModal(${h.id}, ${h.prestador_id}, '${h.prestador_nome}', '${h.servico || ''}')">Avaliar</button>` : ''}
      </div>
    `).join('') : '<p>Nenhum serviço solicitado ainda.</p>';
  } catch (err) {
    list.innerHTML = `<p>Erro: ${err.message}</p>`;
  }
}

function openReviewModal(historyId, providerId, providerNome, servico) {
  reviewTargetHistoryId = historyId;
  reviewTargetProviderId = providerId;
  selectedStars = 0;
  document.querySelectorAll('#starInput span').forEach(s => s.classList.remove('active'));
  document.getElementById('reviewComment').value = '';
  document.getElementById('reviewProviderName').textContent = `${providerNome} — ${servico}`;
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

document.getElementById('submitReview').addEventListener('click', async () => {
  if (!selectedStars) { alert('Selecione uma nota de 1 a 5 estrelas.'); return; }
  try {
    await api('/avaliacoes', {
      method: 'POST',
      body: JSON.stringify({
        prestador_id: reviewTargetProviderId,
        usuario_id: currentUser.id,
        nota: selectedStars,
        comentario: document.getElementById('reviewComment').value,
        historico_id: reviewTargetHistoryId,
      }),
    });
    document.getElementById('reviewModal').classList.add('hidden');
    renderHistory();
  } catch (err) {
    alert('Erro ao enviar avaliação: ' + err.message);
  }
});

/* ---------- INIT ---------- */
navigate('home');
