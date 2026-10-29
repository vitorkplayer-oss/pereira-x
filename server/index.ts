import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

declare module 'express-session' {
  interface SessionData { isAdmin?: boolean }
}
const app = express()
const PORT = Number(process.env.PORT || 3001)
const isProd = process.env.NODE_ENV === 'production'
if (!process.env.SESSION_SECRET) {
  console.warn('AVISO: defina SESSION_SECRET no arquivo .env antes de usar em rede.')
}
const dataDir = path.resolve('data')
fs.mkdirSync(dataDir, { recursive: true })
const db = new Database(path.join(dataDir, 'pereira-x.sqlite'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL,
 category_id INTEGER NOT NULL REFERENCES categories(id), price REAL NOT NULL CHECK(price >= 0),
 sale_price REAL CHECK(sale_price IS NULL OR sale_price >= 0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
 image TEXT NOT NULL DEFAULT '', specs TEXT NOT NULL DEFAULT '', is_new INTEGER NOT NULL DEFAULT 0,
 best_seller INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
 email TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, zip TEXT NOT NULL,
 shipping TEXT NOT NULL, payment_method TEXT NOT NULL, total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'Recebido',
 demo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
 product_id INTEGER NOT NULL, product_name TEXT NOT NULL, quantity INTEGER NOT NULL,
 unit_price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expired INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expired_idx ON sessions(expired);
`)
const categorySeed = ['Celulares','Notebooks','Tablets','Acessórios']
const insertCat = db.prepare('INSERT OR IGNORE INTO categories(name) VALUES (?)')
categorySeed.forEach(c => insertCat.run(c))
const count = (db.prepare('SELECT COUNT(*) n FROM products').get() as {n:number}).n
if (!count) {
 const cat = (name:string) => (db.prepare('SELECT id FROM categories WHERE name=?').get(name) as {id:number}).id
 const seed = db.prepare(`INSERT INTO products(name,description,category_id,price,sale_price,stock,image,specs,is_new,best_seller,featured)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
 const samples = [
  ['PX Nova 15 Pro','Smartphone de demonstração com tela AMOLED e câmera avançada.',cat('Celulares'),4299,3999,18,'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=900','Tela AMOLED 6,7"; 256 GB; 5G; câmera 50 MP',1,1,1],
  ['PX AirBook 14','Notebook leve para produtividade e criatividade.',cat('Notebooks'),5899,null,9,'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=900','14 polegadas; 16 GB RAM; SSD 512 GB',1,0,1],
  ['PX Tab Ultra','Tablet versátil para trabalho, estudo e entretenimento.',cat('Tablets'),2799,2499,12,'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=900','Tela 11"; 128 GB; Wi-Fi',0,1,1],
  ['PX Buds X','Fones sem fio com estojo compacto e som imersivo.',cat('Acessórios'),499,399,25,'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=900','Bluetooth; estojo USB-C; microfones duplos',0,1,0],
  ['PX Watch One','Relógio inteligente para acompanhar sua rotina.',cat('Acessórios'),899,null,0,'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900','Tela touch; monitoramento de atividade; resistente à água',0,0,0],
  ['PX Phone Lite','Design elegante e desempenho para o dia a dia.',cat('Celulares'),1899,1699,14,'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900','Tela 6,5"; 128 GB; bateria de longa duração',0,0,1]
 ]
 samples.forEach(p => seed.run(...p))
}
class SQLiteSessionStore extends session.Store {
 get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
  try {
   const row = db.prepare('SELECT sess, expired FROM sessions WHERE sid=?').get(sid) as {sess:string;expired:number} | undefined
   if (!row || row.expired <= Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE sid=?').run(sid)
    return callback(null, null)
   }
   callback(null, JSON.parse(row.sess))
  } catch (err) { callback(err) }
 }
 set(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
  try {
   const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000
   db.prepare('INSERT INTO sessions(sid,sess,expired) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expired=excluded.expired').run(sid, JSON.stringify(sess), expires)
   callback?.()
  } catch (err) { callback?.(err) }
 }
 destroy(sid: string, callback?: (err?: any) => void) {
  try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); callback?.() }
  catch (err) { callback?.(err) }
 }
 touch(sid: string, sess: session.SessionData, callback?: (err?: any) => void) {
  try {
   const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000
   db.prepare('UPDATE sessions SET sess=?, expired=? WHERE sid=?').run(JSON.stringify(sess), expires, sid)
   callback?.()
  } catch (err) { callback?.(err) }
 }
}
app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }))
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(session({
 store: new SQLiteSessionStore(),
 secret: process.env.SESSION_SECRET || 'desenvolvimento-local-troque-esta-chave',
 resave: false, saveUninitialized: false,
 cookie: { httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: 8 * 60 * 60 * 1000 }
}))
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: {error:'Muitas tentativas. Aguarde 15 minutos.'} })
const configuredAdminPassword = process.env.ADMIN_PASSWORD || ''
const adminPasswordHash = configuredAdminPassword ? bcrypt.hash(configuredAdminPassword, 12) : Promise.resolve('')
const adminOnly: express.RequestHandler = (req,res,next) => req.session.isAdmin ? next() : res.status(401).json({error:'Autenticação necessária.'})
const money = (n:number) => Number(n.toFixed(2))
const productSelect = `SELECT p.*, c.name category FROM products p JOIN categories c ON c.id=p.category_id`
app.get('/api/health', (_req,res) => res.json({ok:true}))
app.get('/api/categories', (_req,res) => res.json(db.prepare('SELECT * FROM categories ORDER BY id').all()))
app.get('/api/products', (req,res) => {
 const {q,category,min,max,available} = req.query
 let sql = productSelect + ' WHERE p.active=1'
 const args:any[] = []
 if (q) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; args.push(`%${q}%`,`%${q}%`) }
 if (category && category !== 'Todas') { sql += ' AND c.name=?'; args.push(category) }
 if (min !== undefined && min !== '') { sql += ' AND COALESCE(p.sale_price,p.price)>=?'; args.push(Number(min)) }
 if (max !== undefined && max !== '') { sql += ' AND COALESCE(p.sale_price,p.price)<=?'; args.push(Number(max)) }
 if (available === 'true') sql += ' AND p.stock>0'
 sql += ' ORDER BY p.featured DESC, p.created_at DESC'
 res.json(db.prepare(sql).all(...args))
})
app.get('/api/products/:id', (req,res) => {
 const p = db.prepare(productSelect + ' WHERE p.id=? AND p.active=1').get(Number(req.params.id))
 p ? res.json(p) : res.status(404).json({error:'Produto não encontrado.'})
})
app.post('/api/orders', (req,res) => {
 const {customer,items,shipping,paymentMethod} = req.body || {}
 if (!customer || !Array.isArray(items) || !items.length || !shipping || !paymentMethod) return res.status(400).json({error:'Preencha os dados obrigatórios.'})
 const required = ['name','email','address','city','state','zip']
 if (required.some(k => typeof customer[k] !== 'string' || !customer[k].trim())) return res.status(400).json({error:'Dados do cliente incompletos.'})
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return res.status(400).json({error:'E-mail inválido.'})
 try {
  const create = db.transaction(() => {
   let total = 0
   const lines:any[] = []
   const quantities = new Map<number, number>()
   for (const item of items) {
    const productId = Number(item.productId)
    const qty = Number(item.quantity)
    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(qty) || qty < 1) throw new Error('Produto ou quantidade inválida.')
    quantities.set(productId, (quantities.get(productId) || 0) + qty)
   }
   for (const [productId, qty] of quantities) {
    const p:any = db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId)
    if (!p || p.stock < qty) throw new Error(`Estoque insuficiente para ${p?.name || 'um produto'}.`)
    const price = p.sale_price ?? p.price
    total += price * qty
    lines.push({p,qty,price})
   }
   const fee = shipping === 'Expresso' ? 29.90 : shipping === 'Padrão' ? 14.90 : 0
   total = money(total + fee)
   const orderNo = 'PX-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random()*900+100)
   const info:any = db.prepare(`INSERT INTO orders(order_number,customer_name,email,address,city,state,zip,shipping,payment_method,total)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).run(orderNo,customer.name.trim(),customer.email.trim(),customer.address.trim(),customer.city.trim(),customer.state.trim().toUpperCase(),customer.zip.trim(),shipping,paymentMethod,total)
   const orderId = Number(info.lastInsertRowid)
   const addItem = db.prepare('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES(?,?,?,?,?)')
   const updateStock = db.prepare('UPDATE products SET stock=stock-? WHERE id=?')
   lines.forEach(({p,qty,price}) => { addItem.run(orderId,p.id,p.name,qty,price); updateStock.run(qty,p.id) })
   return {orderNumber:orderNo,total}
  })
  res.status(201).json(create())
 } catch(e:any) { res.status(400).json({error:e.message || 'Não foi possível criar o pedido.'}) }
})
app.post('/api/admin/login', loginLimiter, async (req,res) => {
 const {username,password} = req.body || {}
 const expectedUser = process.env.ADMIN_USERNAME || 'admin'
 if (!configuredAdminPassword) return res.status(503).json({error:'Configure ADMIN_PASSWORD no arquivo .env.'})
 const valid = typeof username === 'string' && typeof password === 'string' && username === expectedUser && await bcrypt.compare(password, await adminPasswordHash)
 if (!valid) return res.status(401).json({error:'Usuário ou senha incorretos.'})
 req.session.regenerate(err => {
  if (err) return res.status(500).json({error:'Não foi possível iniciar a sessão.'})
  req.session.isAdmin = true
  req.session.save(err2 => err2 ? res.status(500).json({error:'Erro ao salvar sessão.'}) : res.json({ok:true}))
 })
})
app.get('/api/admin/session', (req,res) => res.json({authenticated:!!req.session.isAdmin}))
app.post('/api/admin/logout', adminOnly, (req,res) => req.session.destroy(() => res.clearCookie('connect.sid').json({ok:true})))
app.get('/api/admin/stats', adminOnly, (_req,res) => {
 const products = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN active=1 AND stock>0 THEN 1 ELSE 0 END) available,
 SUM(CASE WHEN active=1 AND stock=0 THEN 1 ELSE 0 END) outOfStock,
 SUM(CASE WHEN active=1 AND stock>0 AND stock<=5 THEN 1 ELSE 0 END) lowStock FROM products`).get()
 const orders = db.prepare('SELECT COUNT(*) total FROM orders').get()
 res.json({products,orders})
})
app.get('/api/admin/products', adminOnly, (_req,res) => res.json(db.prepare(productSelect + ' ORDER BY p.id DESC').all()))
app.post('/api/admin/products', adminOnly, (req,res) => {
 const p=req.body || {}
 if (!p.name?.trim() || !p.description?.trim() || !p.category_id || !Number.isFinite(Number(p.price)) || Number(p.price)<0 || !Number.isInteger(Number(p.stock)) || Number(p.stock)<0) return res.status(400).json({error:'Confira nome, descrição, categoria, preço e estoque.'})
 if (p.sale_price !== null && p.sale_price !== '' && (Number(p.sale_price)<0 || Number(p.sale_price)>Number(p.price))) return res.status(400).json({error:'Preço promocional deve ser válido e menor que o preço normal.'})
 try {
  const r:any=db.prepare(`INSERT INTO products(name,description,category_id,price,sale_price,stock,image,specs,is_new,best_seller,featured,active)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(p.name.trim(),p.description.trim(),Number(p.category_id),Number(p.price),p.sale_price===''||p.sale_price==null?null:Number(p.sale_price),Number(p.stock),p.image||'',p.specs||'',+!!p.is_new,+!!p.best_seller,+!!p.featured,p.active===false?0:1)
  res.status(201).json({id:r.lastInsertRowid})
 } catch { res.status(400).json({error:'Categoria inválida ou dados não aceitos.'}) }
})
app.put('/api/admin/products/:id', adminOnly, (req,res) => {
 const p=req.body || {}
 if (!p.name?.trim() || !p.description?.trim() || !p.category_id || !Number.isFinite(Number(p.price)) || Number(p.price)<0 || !Number.isInteger(Number(p.stock)) || Number(p.stock)<0) return res.status(400).json({error:'Confira os campos obrigatórios.'})
 if (p.sale_price!==null && p.sale_price!=='' && (Number(p.sale_price)<0 || Number(p.sale_price)>Number(p.price))) return res.status(400).json({error:'Preço promocional inválido.'})
 const r=db.prepare(`UPDATE products SET name=?,description=?,category_id=?,price=?,sale_price=?,stock=?,image=?,specs=?,is_new=?,best_seller=?,featured=?,active=? WHERE id=?`)
 .run(p.name.trim(),p.description.trim(),Number(p.category_id),Number(p.price),p.sale_price===''||p.sale_price==null?null:Number(p.sale_price),Number(p.stock),p.image||'',p.specs||'',+!!p.is_new,+!!p.best_seller,+!!p.featured,p.active===false?0:1,Number(req.params.id))
 res.changes ? res.json({ok:true}) : res.status(404).json({error:'Produto não encontrado.'})
})
app.delete('/api/admin/products/:id', adminOnly, (req,res) => {
 const r=db.prepare('UPDATE products SET active=0 WHERE id=?').run(Number(req.params.id))
 r.changes ? res.json({ok:true}) : res.status(404).json({error:'Produto não encontrado.'})
})
app.get('/api/admin/orders', adminOnly, (_req,res) => {
 const orders:any[] = db.prepare('SELECT * FROM orders ORDER BY id DESC').all()
 const getItems=db.prepare('SELECT * FROM order_items WHERE order_id=?')
 res.json(orders.map(o=>({...o,items:getItems.all(o.id)})))
})
app.patch('/api/admin/orders/:id', adminOnly, (req,res) => {
 const allowed=['Recebido','Em preparação','Enviado','Concluído','Cancelado']
 if (!allowed.includes(req.body?.status)) return res.status(400).json({error:'Status inválido.'})
 const r=db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,Number(req.params.id))
 r.changes ? res.json({ok:true}) : res.status(404).json({error:'Pedido não encontrado.'})
})
app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({error:'Erro interno do servidor.'})})
app.listen(PORT, () => console.log(`Pereira X API em http://localhost:${PORT}`))
