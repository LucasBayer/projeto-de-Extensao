/* =============================================
   CONECTA SERVIÇOS — main.js
   ÚNICO arquivo JS, compartilhado por TODAS as páginas.
   Cada bloco só roda se os elementos daquela página existirem
   (por isso é seguro incluir este mesmo arquivo em todo HTML).
============================================= */

const API = '/api';
let currentUser = JSON.parse(localStorage.getItem('cs_currentUser')) || null;

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

/* ---------- MENU MOBILE (header presente em todas as páginas) ---------- */
const navToggle = document.getElementById('navToggle');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    document.querySelector('.site-header').classList.toggle('open');
  });
}

/* ---------- ÁREA LOGADA NO HEADER ---------- */
function renderAuthArea() {
  const area = document.getElementById('authArea');
  if (!area) return;
  if (currentUser) {
    area.innerHTML = `
      <span style="color:var(--bg-dominant); font-size:.9rem;">Olá, ${currentUser.nome.split(' ')[0]}</span>
      <button class="btn btn-ghost" id="logoutBtn">Sair</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', () => {
      currentUser = null;
      localStorage.removeItem('cs_currentUser');
      window.location.href = 'index.html';
    });
  } else {
    area.innerHTML = `
      <a class="btn btn-ghost" href="login.html">Entrar</a>
      <a class="btn btn-accent" href="cadastro.html">Cadastrar</a>
    `;
  }
}
renderAuthArea();

/* ---------- HELPERS DE CARD (usados em home.html e busca.html) ---------- */
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
      <button class="btn btn-secondary" onclick="openProviderModal(${p.id})">Ver perfil</button>
      <button class="btn btn-accent" onclick="contatarPrestador(${p.id}, '${p.contato}', '${(p.profissao || '').replace(/'/g, '')}')">Contato</button>
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

/* ---------- MODAL DE PERFIL DO PRESTADOR (usado em home.html e busca.html) ---------- */
async function openProviderModal(id) {
  const modal = document.getElementById('providerModal');
  if (!modal) return;
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
      <button class="btn btn-accent btn-block" onclick="contatarPrestador(${p.id}, '${p.contato}', '${p.profissao}')">Chamar no WhatsApp</button>
      <hr style="margin:14px 0;">
      <h4>Avaliações</h4>
      ${comentariosHtml}
    `;
    modal.classList.remove('hidden');
  } catch (err) {
    alert('Erro ao carregar perfil: ' + err.message);
  }
}
const closeProviderModalBtn = document.getElementById('closeProviderModal');
if (closeProviderModalBtn) {
  closeProviderModalBtn.addEventListener('click', () =>
    document.getElementById('providerModal').classList.add('hidden'));
}

/* =========================================================
   PÁGINA: index.html (HOME)
========================================================= */
const featuredGrid = document.getElementById('featuredGrid');
if (featuredGrid) {
  (async () => {
    try {
      const prestadores = await api('/prestadores?ordenar=relevancia');
      featuredGrid.innerHTML = prestadores.slice(0, 3).map(cardTemplate).join('');
    } catch (err) {
      featuredGrid.innerHTML = `<p>Não foi possível carregar prestadores (${err.message}).</p>`;
    }
  })();

  (async () => {
    try {
      const professions = await api('/profissoes');
      document.getElementById('categoryChips').innerHTML = professions.map(prof =>
        `<span class="chip" onclick="location.href='busca.html?profissao=${encodeURIComponent(prof)}'">${prof}</span>`).join('');
    } catch (err) { console.warn(err); }
  })();

  const heroBtn = document.getElementById('heroSearchBtn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      const q = document.getElementById('heroSearchInput').value;
      const cidade = document.getElementById('heroCitySelect').value;
      location.href = `busca.html?busca=${encodeURIComponent(q)}&cidade=${encodeURIComponent(cidade)}`;
    });
  }
}

/* =========================================================
   PÁGINA: busca.html
========================================================= */
const resultsGrid = document.getElementById('resultsGrid');
if (resultsGrid) {
  const urlParams = new URLSearchParams(window.location.search);

  async function populateProfessionFilter() {
    const select = document.getElementById('filterProfession');
    try {
      const professions = await api('/profissoes');
      select.innerHTML = '<option value="">Todas</option>' + professions.map(p => `<option>${p}</option>`).join('');
      if (urlParams.get('profissao')) select.value = urlParams.get('profissao');
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
      resultsGrid.innerHTML = prestadores.length ? prestadores.map(cardTemplate).join('') : '<p>Nenhum prestador encontrado com esses filtros.</p>';
    } catch (err) {
      document.getElementById('resultsCount').textContent = '';
      resultsGrid.innerHTML = `<p>Erro ao buscar: ${err.message}</p>`;
    }
  }

  document.getElementById('filterKeyword').value = urlParams.get('busca') || '';
  document.getElementById('filterCity').value = urlParams.get('cidade') || '';

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

  populateProfessionFilter().then(renderResults);
}

/* =========================================================
   PÁGINA: login.html
========================================================= */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    try {
      const usuario = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
      currentUser = usuario;
      localStorage.setItem('cs_currentUser', JSON.stringify(currentUser));
      msg.className = 'form-msg success';
      msg.textContent = 'Login realizado com sucesso! Redirecionando...';
      setTimeout(() => window.location.href = 'index.html', 800);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
    }
  });
}

/* =========================================================
   PÁGINA: cadastro.html
========================================================= */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
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
      msg.className = 'form-msg success';
      msg.textContent = 'Cadastro realizado com sucesso!';
      setTimeout(() => window.location.href = tipo === 'prestador' ? 'perfil.html' : 'index.html', 800);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
    }
  });
}

/* =========================================================
   PÁGINA: perfil.html
========================================================= */
const providerForm = document.getElementById('providerForm');
if (providerForm) {
  providerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('providerMsg');
    if (!currentUser) {
      msg.className = 'form-msg error';
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
      msg.className = 'form-msg success';
      msg.textContent = 'Serviço publicado com sucesso!';
      providerForm.reset();
      renderMyServices();
    } catch (err) {
      msg.className = 'form-msg error';
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
      grid.innerHTML = meus.length
        ? meus.map(p => cardTemplate({ ...p, rating: 0, avaliacoes: 0 })).join('')
        : '<p>Você ainda não publicou nenhum serviço.</p>';
    } catch (err) {
      grid.innerHTML = `<p>Erro: ${err.message}</p>`;
    }
  }
  renderMyServices();
}

/* =========================================================
   PÁGINA: historico.html
========================================================= */
const historyList = document.getElementById('historyList');
if (historyList) {
  let reviewTargetHistoryId = null;
  let reviewTargetProviderId = null;
  let selectedStars = 0;

  async function renderHistory() {
    if (!currentUser) {
      historyList.innerHTML = '<p>Faça login para ver seu histórico de serviços.</p>';
      return;
    }
    try {
      const historico = await api(`/historico/${currentUser.id}`);
      historyList.innerHTML = historico.length ? historico.map(h => `
        <div class="history-item">
          <div class="history-item__info">
            <h4>${h.servico || 'Serviço'} — ${h.prestador_nome}</h4>
            <p>Solicitado em ${new Date(h.data_solicitacao).toLocaleDateString('pt-BR')}</p>
          </div>
          <span class="status status--${h.status}">${
            h.status === 'concluido' ? 'Concluído' : h.status === 'andamento' ? 'Em andamento' : 'Avaliado'
          }</span>
          ${h.status === 'concluido' ? `<button class="btn btn-accent" onclick="openReviewModal(${h.id}, ${h.prestador_id}, '${h.prestador_nome}', '${h.servico || ''}')">Avaliar</button>` : ''}
        </div>
      `).join('') : '<p>Nenhum serviço solicitado ainda.</p>';
    } catch (err) {
      historyList.innerHTML = `<p>Erro: ${err.message}</p>`;
    }
  }

  window.openReviewModal = function (historyId, providerId, providerNome, servico) {
    reviewTargetHistoryId = historyId;
    reviewTargetProviderId = providerId;
    selectedStars = 0;
    document.querySelectorAll('#starInput span').forEach(s => s.classList.remove('active'));
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewProviderName').textContent = `${providerNome} — ${servico}`;
    document.getElementById('reviewModal').classList.remove('hidden');
  };

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

  renderHistory();
}
