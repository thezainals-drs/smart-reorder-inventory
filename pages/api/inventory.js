import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

async function getSheet() {
  const jwt = new JWT({ email:CLIENT_EMAIL, key:PRIVATE_KEY, scopes:['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(SHEET_ID, jwt);
  await doc.loadInfo();
  return doc.sheetsByIndex[0];
}

export default async function handler(req, res) {
  try {
    const sheet = await getSheet();
    if (req.method === 'GET') {
      const rows = await sheet.getRows();
      const data = rows.map((row, i) => ({
        id: i+1,
        name: row.get('name')||'',
        code: row.get('code')||'',
        expiry: row.get('expiry')||'',
        qty: parseInt(row.get('qty'))||0,
        label: row.get('label')||'',
        pricing: row.get('pricing')||'Full Price',
        price: row.get('price')||'',
        soldTo: row.get('soldTo')||'',
        notes: row.get('notes')||'',
        status: row.get('status')||'available',
        _rowIndex: i,
      }));
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { name,code,expiry,qty,label,pricing,price,soldTo,notes,status } = req.body;
      await sheet.addRow({ name,code,expiry,qty,label,pricing,price,soldTo,notes,status });
      return res.status(200).json({ success:true });
    }
    if (req.method === 'PUT') {
      const { _rowIndex,name,code,expiry,qty,label,pricing,price,soldTo,notes,status } = req.body;
      const rows = await sheet.getRows();
      const row = rows[_rowIndex];
      if (!row) return res.status(404).json({ error:'Row not found' });
      row.set('name',name); row.set('code',code); row.set('expiry',expiry);
      row.set('qty',qty); row.set('label',label); row.set('pricing',pricing);
      row.set('price',price); row.set('soldTo',soldTo); row.set('notes',notes);
      row.set('status',status);
      await row.save();
      return res.status(200).json({ success:true });
    }
    if (req.method === 'DELETE') {
      const { _rowIndex } = req.body;
      const rows = await sheet.getRows();
      const row = rows[_rowIndex];
      if (!row) return res.status(404).json({ error:'Row not found' });
      await row.delete();
      return res.status(200).json({ success:true });
    }
    return res.status(405).json({ error:'Method not allowed' });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:err.message });
  }
}
