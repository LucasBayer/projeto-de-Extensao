// server.js — API Express que liga o front-end ao PostgreSQL
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve index.html, style.css, script.js

/* =========================================================
   AUTENTICAÇÃO (simplificada, sem token/sessão — protótipo)
========================================================= */

app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha, telefone, cidade, tipo } = req.body;
    if (!nome || !email || !senha || !tipo) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone, cidade, tipo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, telefone, cidade, tipo`,
      [nome, email, senhaHash, telefone, cidade, tipo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'E-mail já cadastrado.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = result.rows[0];
    if (!usuario) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });

    delete usuario.senha_hash;
    res.json(usuario);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao fazer login.' });
  }
});

/* =========================================================
   PRESTADORES / BUSCA COM FILTROS
========================================================= */

app.get('/api/prestadores', async (req, res) => {
  try {
    const { busca, cidade, profissao, precoMax, ordenar } = req.query;

    let sql = `
      SELECT p.*, 
             COALESCE(AVG(a.nota), 0)::numeric(3,1) AS rating,
             COUNT(a.id) AS avaliacoes
      FROM prestadores p
      LEFT JOIN avaliacoes a ON a.prestador_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (busca) {
      params.push(`%${busca.toLowerCase()}%`);
      sql += ` AND (LOWER(p.nome) LIKE $${params.length} OR LOWER(p.profissao) LIKE $${params.length})`;
    }
    if (cidade) {
      params.push(cidade);
      sql += ` AND p.cidade = $${params.length}`;
    }
    if (profissao) {
      params.push(profissao);
      sql += ` AND p.profissao = $${params.length}`;
    }
    if (precoMax) {
      params.push(precoMax);
      sql += ` AND p.preco <= $${params.length}`;
    }

    sql += ' GROUP BY p.id';

    if (ordenar === 'preco-asc') sql += ' ORDER BY p.preco ASC';
    else if (ordenar === 'preco-desc') sql += ' ORDER BY p.preco DESC';
    else if (ordenar === 'avaliacao') sql += ' ORDER BY rating DESC';
    else sql += ' ORDER BY p.requisicoes DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar prestadores.' });
  }
});

app.get('/api/prestadores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prestador = await pool.query(
      `SELECT p.*, COALESCE(AVG(a.nota),0)::numeric(3,1) AS rating, COUNT(a.id) AS avaliacoes
       FROM prestadores p LEFT JOIN avaliacoes a ON a.prestador_id = p.id
       WHERE p.id = $1 GROUP BY p.id`, [id]
    );
    if (!prestador.rows[0]) return res.status(404).json({ erro: 'Prestador não encontrado.' });

    const comentarios = await pool.query(
      `SELECT a.nota, a.comentario, a.criado_em, u.nome AS autor
       FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.prestador_id = $1 ORDER BY a.criado_em DESC`, [id]
    );
    res.json({ ...prestador.rows[0], comentarios: comentarios.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar prestador.' });
  }
});

app.get('/api/profissoes', async (req, res) => {
  const result = await pool.query('SELECT DISTINCT profissao FROM prestadores ORDER BY profissao');
  res.json(result.rows.map(r => r.profissao));
});

app.post('/api/prestadores', async (req, res) => {
  try {
    const { usuario_id, nome, profissao, cidade, preco, contato, descricao, foto_url } = req.body;
    const result = await pool.query(
      `INSERT INTO prestadores (usuario_id, nome, profissao, cidade, preco, contato, descricao, foto_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [usuario_id, nome, profissao, cidade, preco, contato, descricao, foto_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao publicar serviço.' });
  }
});

app.get('/api/prestadores/usuario/:usuarioId', async (req, res) => {
  const result = await pool.query('SELECT * FROM prestadores WHERE usuario_id = $1 ORDER BY criado_em DESC', [req.params.usuarioId]);
  res.json(result.rows);
});

/* =========================================================
   HISTÓRICO DE SERVIÇOS
========================================================= */

app.get('/api/historico/:usuarioId', async (req, res) => {
  const result = await pool.query(
    `SELECT h.*, p.nome AS prestador_nome
     FROM historico h JOIN prestadores p ON p.id = h.prestador_id
     WHERE h.usuario_id = $1 ORDER BY h.data_solicitacao DESC`,
    [req.params.usuarioId]
  );
  res.json(result.rows);
});

app.post('/api/historico', async (req, res) => {
  try {
    const { usuario_id, prestador_id, servico } = req.body;
    await pool.query('UPDATE prestadores SET requisicoes = requisicoes + 1 WHERE id = $1', [prestador_id]);
    const result = await pool.query(
      `INSERT INTO historico (usuario_id, prestador_id, servico) VALUES ($1,$2,$3) RETURNING *`,
      [usuario_id, prestador_id, servico]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar solicitação.' });
  }
});

app.put('/api/historico/:id/status', async (req, res) => {
  const { status } = req.body;
  const result = await pool.query('UPDATE historico SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(result.rows[0]);
});

/* =========================================================
   AVALIAÇÕES
========================================================= */

app.post('/api/avaliacoes', async (req, res) => {
  try {
    const { prestador_id, usuario_id, nota, comentario, historico_id } = req.body;
    const result = await pool.query(
      `INSERT INTO avaliacoes (prestador_id, usuario_id, nota, comentario) VALUES ($1,$2,$3,$4) RETURNING *`,
      [prestador_id, usuario_id, nota, comentario]
    );
    if (historico_id) {
      await pool.query(`UPDATE historico SET status = 'avaliado' WHERE id = $1`, [historico_id]);
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao enviar avaliação.' });
  }
});

/* =========================================================
   INICIALIZAÇÃO
========================================================= */
const PORT = process.env.PORT || 3000;
// "0.0.0.0" é essencial: faz o servidor aceitar conexões vindas de OUTROS
// computadores/celulares na mesma rede Wi-Fi, não só do seu próprio PC.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log('Para acessar de outro dispositivo na mesma rede, use o IP local da sua máquina.');
});
