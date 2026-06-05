import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const PRODUCTS = [
  {name:"LB-30",expiry:"18 Feb 2027",qty:5,label:"Jul–Nov batch",pricing:"Full Price",price:"",soldTo:"",notes:"Farah's LB-30",status:"available"},
  {name:"LB-30",expiry:"11 March 2027",qty:2,label:"Dec–Jan batch",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"LB-30",expiry:"20 April 2027",qty:2,label:"Feb–Mar batch",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"LB-30",expiry:"",qty:7,label:"To sell",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"Broculin",expiry:"",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"Broculin",expiry:"",qty:1,label:"Pohly",pricing:"Full Price",price:"",soldTo:"",notes:"Pohly's",status:"available"},
  {name:"Zinc A&C",expiry:"31 Aug 2027",qty:11,label:"Jun–Apr 2027",pricing:"Full Price",price:"",soldTo:"",notes:"Hair & nails, immunity",status:"available"},
  {name:"Omega 3 Plus",expiry:"10 Dec 2027",qty:6,label:"Jun–Nov batch",pricing:"Full Price",price:"",soldTo:"",notes:"Circulation",status:"available"},
  {name:"Omega 3 Plus",expiry:"30 April 2028",qty:7,label:"Dec–Jun batch",pricing:"Full Price",price:"",soldTo:"",notes:"Circulation",status:"available"},
  {name:"PhosChol",expiry:"16 June 2027",qty:2,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"Overall exp 7 Nov 2027",status:"available"},
  {name:"i-Care Gold",expiry:"18 Nov 2027",qty:4,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"GloCaps",expiry:"17 Nov 2026",qty:1,label:"Feb batch",pricing:"Full Price",price:"",soldTo:"",notes:"Antioxidants",status:"available"},
  {name:"GloCaps",expiry:"30 March 2027",qty:1,label:"Apr batch",pricing:"Full Price",price:"",soldTo:"",notes:"Antioxidants",status:"available"},
  {name:"HA Jelly",expiry:"17 Dec 2026",qty:10,label:"Farah's batch",pricing:"Full Price",price:"",soldTo:"",notes:"Farah's HA Jelly",status:"available"},
  {name:"HA Jelly",expiry:"17 Dec 2026",qty:5,label:"To sell",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"HA Jelly",expiry:"25 Sept 2026",qty:0,label:"Original stock",pricing:"Full Price",price:"",soldTo:"",notes:"Check remaining",status:"available"},
  {name:"Propolis",expiry:"9 Oct 2027",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"QQ Collagen",expiry:"11 Feb 2027",qty:1,label:"First box",pricing:"Full Price",price:"122.50",soldTo:"",notes:"RM 122.50/box",status:"available"},
  {name:"QQ Collagen",expiry:"11 Feb 2027",qty:12,label:"Feb batch",pricing:"Full Price",price:"122.50",soldTo:"",notes:"",status:"available"},
  {name:"QQ Collagen",expiry:"11 Feb 2027",qty:11,label:"Mar batch",pricing:"Full Price",price:"122.50",soldTo:"",notes:"",status:"available"},
  {name:"QQ Collagen",expiry:"11 Feb 2027",qty:4,label:"Apr batch",pricing:"Full Price",price:"122.50",soldTo:"",notes:"",status:"available"},
  {name:"eZZE",expiry:"12 Sept 2026",qty:8,label:"Apr batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"Curvea",expiry:"",qty:2,label:"At Curvena",pricing:"Full Price",price:"",soldTo:"",notes:"Fibre. Located at Curvena",status:"available"},
  {name:"Optrimax Punch",expiry:"28 Aug 2026",qty:5,label:"Feb batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"Optrimax Punch",expiry:"28 Aug 2026",qty:2,label:"May batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"Zyme",expiry:"21 July 2026",qty:5,label:"Feb batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"VG Mix",expiry:"21 July 2026",qty:5,label:"Feb batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"VG Mix",expiry:"21 July 2026",qty:1,label:"May batch",pricing:"Full Price",price:"",soldTo:"",notes:"URGENT",status:"available"},
  {name:"Juiced!",expiry:"14 June 2026",qty:2,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"CRITICAL — exp this month",status:"available"},
  {name:"Collagen Plus",expiry:"28 Oct 2026",qty:1,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"Borage Seed Oil",expiry:"",qty:3,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"",status:"available"},
  {name:"Cal/Mag",expiry:"",qty:0,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"Replenish stock",status:"available"},
  {name:"EPO",expiry:"",qty:0,label:"",pricing:"Full Price",price:"",soldTo:"",notes:"Female health — replenish",status:"available"},
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jwt = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(SHEET_ID, jwt);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRows(PRODUCTS);

    return res.status(200).json({ success: true, count: PRODUCTS.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
