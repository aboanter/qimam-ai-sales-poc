// ============================================================
// DATASET (same seeded generator as before — deterministic mock
// data standing in for Odoo)
// ============================================================
function mulberry32(seed){return function(){seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand = mulberry32(20250101);
const pick = (arr)=>arr[Math.floor(rand()*arr.length)];
const randInt=(min,max)=>Math.floor(rand()*(max-min+1))+min;
const randFloat=(min,max)=>rand()*(max-min)+min;
const weightedPick=(items)=>{const total=items.reduce((s,i)=>s+i[1],0);let r=rand()*total;for(const [v,w] of items){if(r<w)return v;r-=w;}return items[items.length-1][0];};

const CITY_REGION={'الرياض':'الوسطى','جدة':'الغربية','مكة المكرمة':'الغربية','المدينة المنورة':'الغربية','الدمام':'الشرقية','الخبر':'الشرقية','أبها':'الجنوبية'};
const CITIES=Object.keys(CITY_REGION);
const PRODUCTS=[
  {id:'P01',name:'باقة أساسية',category:'الاشتراكات',price:500,costRatio:.30},
  {id:'P02',name:'باقة متقدمة',category:'الاشتراكات',price:1200,costRatio:.25},
  {id:'P03',name:'نظام نقاط البيع',category:'الأجهزة والبرمجيات',price:3500,costRatio:.55},
  {id:'P04',name:'التنفيذ والتأهيل',category:'الخدمات',price:8000,costRatio:.60},
  {id:'P05',name:'التدريب',category:'الخدمات',price:2500,costRatio:.40},
  {id:'P06',name:'الدعم الفني',category:'الخدمات',price:1000,costRatio:.35},
  {id:'P07',name:'تكامل واجهات برمجية',category:'الخدمات',price:6000,costRatio:.50},
  {id:'P08',name:'مستخدم إضافي',category:'الاشتراكات',price:150,costRatio:.20},
  {id:'P09',name:'إضافة الفوترة الإلكترونية',category:'الامتثال',price:900,costRatio:.30},
];
const SALESPEOPLE=['سارة العتيبي','محمد القحطاني','نورة الدوسري','عبدالله الحربي','ريم الشهري','فيصل المطيري'];
const SEGMENTS=[['صغيرة جداً',.45],['صغيرة',.35],['متوسطة',.20]];
const PAYMENT_METHODS=['تحويل بنكي','بطاقة ائتمان','مدى','شيك'];
const COMPANY_PREFIX=['مؤسسة','شركة','مجموعة','مكتب'];
const COMPANY_CORE=['النخبة','الرواد','الأفق','التميز','الإبداع','المسار','القمة','الريادة','الوفاء','البناء','الثقة','الصفوة','المتحدة','الخليج','النجاح','الأصالة','الفا','الوطنية','الحديثة','السلام'];
const COMPANY_SUFFIX=['للتجارة','للمقاولات','للتقنية','للخدمات اللوجستية','للاستثمار','للتسويق','للأغذية','للتصنيع','العقارية','للاستشارات'];

function buildCustomers(n){
  const customers=[]; const used=new Set();
  for(let i=0;i<n;i++){
    let name; do{name=`${pick(COMPANY_PREFIX)} ${pick(COMPANY_CORE)} ${pick(COMPANY_SUFFIX)}`;}while(used.has(name));
    used.add(name);
    const br=rand(); const behavior= br<.55?'good':br<.85?'average':'late';
    customers.push({id:`C${String(i+1).padStart(3,'0')}`,name,segment:weightedPick(SEGMENTS),city:pick(CITIES),behavior,discountTendency:randFloat(0,.15)});
  }
  return customers;
}
const MONTH_SEASONALITY=[.85,.90,.70,.95,1.00,.80,.95,1.05,1.10,1.15,1.20,1.35];
const MONTH_NAMES_AR=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}
function fmtDateISO(d){return d.toISOString().slice(0,10);}
const REFERENCE_DATE=new Date('2026-01-05T00:00:00Z');

function generateDataset(targetCount){
  const customers=buildCustomers(65);
  const records=[]; let invCounter=10000;
  const monthWeights=MONTH_SEASONALITY.map((w,idx)=>[idx,w]);
  while(records.length<targetCount){
    const month=weightedPick(monthWeights);
    const day=randInt(1,daysInMonth(2025,month));
    const date=new Date(Date.UTC(2025,month,day));
    const customer=pick(customers); const product=pick(PRODUCTS);
    const quantity= product.category==='الاشتراكات'? randInt(1,8): randInt(1,3);
    const unitPrice=product.price*randFloat(.95,1.05);
    const subtotal=quantity*unitPrice;
    const discountRate=Math.min(.25, customer.discountTendency + (customer.segment==='متوسطة'?.05:0));
    const discount=subtotal*discountRate;
    const taxable=subtotal-discount; const tax=taxable*.15; const total=taxable+tax;
    const cost=quantity*unitPrice*product.costRatio; const grossProfit=taxable-cost;
    const paymentTermsDays= customer.segment==='متوسطة'? pick([30,45,60]) : pick([15,30]);
    const dueDate=new Date(date.getTime()+paymentTermsDays*86400000);
    let paymentStatus, paymentDate=null; const br=rand();
    if(customer.behavior==='good'){
      if(br<.95){paymentDate=new Date(dueDate.getTime()-randInt(0,10)*86400000); paymentStatus='مدفوعة';}
      else{paymentStatus= dueDate<REFERENCE_DATE?'متأخرة':'جزئية';}
    }else if(customer.behavior==='average'){
      if(br<.65){paymentDate=new Date(dueDate.getTime()+randInt(-5,15)*86400000); paymentStatus='مدفوعة';}
      else if(br<.85){paymentStatus='جزئية';} else{paymentStatus='متأخرة';}
    }else{
      if(br<.30){paymentDate=new Date(dueDate.getTime()+randInt(10,45)*86400000); paymentStatus='مدفوعة';}
      else if(br<.55){paymentStatus='جزئية';} else{paymentStatus='متأخرة';}
    }
    if(dueDate>REFERENCE_DATE && paymentStatus==='متأخرة') paymentStatus='جزئية';
    if(paymentDate && paymentDate>REFERENCE_DATE) paymentDate=null;
    invCounter++;
    records.push({
      date:fmtDateISO(date), month_index:month, month:MONTH_NAMES_AR[month], quarter:Math.floor(month/3)+1,
      invoice_number:`INV-2025-${invCounter}`, customer_id:customer.id, customer_name:customer.name,
      customer_segment:customer.segment, product_id:product.id, product_name:product.name, product_category:product.category,
      quantity, unit_price:Math.round(unitPrice*100)/100, subtotal:Math.round(subtotal*100)/100,
      discount:Math.round(discount*100)/100, tax:Math.round(tax*100)/100, total:Math.round(total*100)/100,
      cost:Math.round(cost*100)/100, gross_profit:Math.round(grossProfit*100)/100,
      payment_status:paymentStatus, invoice_status:'مؤكدة', salesperson:pick(SALESPEOPLE),
      city:customer.city, region:CITY_REGION[customer.city], payment_method:pick(PAYMENT_METHODS),
      due_date:fmtDateISO(dueDate), payment_date: paymentDate?fmtDateISO(paymentDate):null,
    });
  }
  records.sort((a,b)=>a.date.localeCompare(b.date));
  return records;
}

const KNOWN_DIMENSIONS=['customer','product','category','month','quarter','city','region','salesperson','payment_status','segment'];
const KNOWN_METRICS=['revenue','profit','quantity','invoice_count','avg_invoice','discount_total','discount_pct','margin_pct','overdue_amount','overdue_ratio'];
const KNOWN_OP_TYPES=['aggregate','points','segment'];
const CITIES_LIST=CITIES;
const SEGMENTS_LIST=['صغيرة جداً','صغيرة','متوسطة'];
const MONTHS_LIST=MONTH_NAMES_AR;
const METRIC_LABEL_AR={revenue:'الإيرادات',profit:'الربح',quantity:'الكمية',invoice_count:'عدد الفواتير',avg_invoice:'متوسط الفاتورة',discount_total:'الخصومات',discount_pct:'نسبة الخصم',margin_pct:'هامش الربح',overdue_amount:'المبلغ المتأخر',overdue_ratio:'نسبة المتأخر'};

function applyFilters(data,filters){
  if(!filters || typeof filters!=='object') return data;
  return data.filter(r=>{
    if(filters.city && r.city!==filters.city) return false;
    if(filters.segment && r.customer_segment!==filters.segment) return false;
    if(filters.month && r.month!==filters.month) return false;
    if(filters.quarter && r.quarter!==Number(filters.quarter)) return false;
    if(filters.payment_status && r.payment_status!==filters.payment_status) return false;
    return true;
  });
}
function dimensionValue(r,d){
  switch(d){
    case 'customer':return r.customer_name; case 'product':return r.product_name; case 'category':return r.product_category;
    case 'month':return r.month; case 'quarter':return `Q${r.quarter}`; case 'city':return r.city; case 'region':return r.region;
    case 'salesperson':return r.salesperson; case 'payment_status':return r.payment_status; case 'segment':return r.customer_segment;
    default:return '';
  }
}
function groupByDimension(data,d){const m=new Map(); for(const r of data){const k=dimensionValue(r,d);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;}
function computeMetric(rows,m){
  if(!rows.length)return 0;
  const sum=f=>rows.reduce((s,r)=>s+(Number(f(r))||0),0);
  switch(m){
    case 'revenue':return round2(sum(r=>r.total));
    case 'profit':return round2(sum(r=>r.gross_profit));
    case 'quantity':return sum(r=>r.quantity);
    case 'invoice_count':return new Set(rows.map(r=>r.invoice_number)).size;
    case 'avg_invoice':{const n=new Set(rows.map(r=>r.invoice_number)).size;return n?round2(sum(r=>r.total)/n):0;}
    case 'discount_total':return round2(sum(r=>r.discount));
    case 'discount_pct':{const sub=sum(r=>r.subtotal);return sub?round4(sum(r=>r.discount)/sub):0;}
    case 'margin_pct':{const rev=sum(r=>r.total);return rev?round4(sum(r=>r.gross_profit)/rev):0;}
    case 'overdue_amount':return round2(sum(r=>r.payment_status==='متأخرة'?r.total:0));
    case 'overdue_ratio':{const rev=sum(r=>r.total);return rev?round4(sum(r=>r.payment_status==='متأخرة'?r.total:0)/rev):0;}
    default:return 0;
  }
}
function computeRowMetric(r,m){
  switch(m){
    case 'revenue': return r.total; case 'profit': return r.gross_profit; case 'quantity': return r.quantity;
    case 'invoice_count': return 1; case 'avg_invoice': return r.total; case 'discount_total': return r.discount;
    case 'discount_pct': return r.subtotal? round4(r.discount/r.subtotal) : 0;
    case 'margin_pct': return r.total? round4(r.gross_profit/r.total) : 0;
    case 'overdue_amount': return r.payment_status==='متأخرة'? r.total : 0;
    case 'overdue_ratio': return r.payment_status==='متأخرة'? 1 : 0;
    default: return 0;
  }
}
function round2(v){ return Math.round(v*100)/100; }
function round4(v){ return Math.round(v*10000)/10000; }

function validateOp(op){
  if(!op || typeof op!=='object') return 'operation is not an object';
  if(typeof op.name!=='string' || !op.name) return 'operation missing "name"';
  if(!KNOWN_OP_TYPES.includes(op.type)) return `unknown operation type "${op.type}"`;
  if(op.type==='aggregate'){
    if(op.groupBy!=null && !KNOWN_DIMENSIONS.includes(op.groupBy)) return `unknown groupBy "${op.groupBy}"`;
    if(!Array.isArray(op.metrics) || !op.metrics.length) return 'aggregate op needs a non-empty "metrics" array';
    for(const m of op.metrics) if(!KNOWN_METRICS.includes(m)) return `unknown metric "${m}"`;
  } else if(op.type==='points'){
    if(op.groupBy!=null && !KNOWN_DIMENSIONS.includes(op.groupBy)) return `unknown groupBy "${op.groupBy}"`;
    if(!KNOWN_METRICS.includes(op.x_metric) || !KNOWN_METRICS.includes(op.y_metric)) return 'points op needs valid x_metric/y_metric';
  } else if(op.type==='segment'){
    if(!KNOWN_DIMENSIONS.includes(op.groupBy)) return 'segment op needs a valid groupBy dimension';
    if(!KNOWN_METRICS.includes(op.x_metric) || !KNOWN_METRICS.includes(op.y_metric)) return 'segment op needs valid x_metric/y_metric';
  }
  return null;
}

function executeAggregate(data, op){
  const filtered = applyFilters(data, op.filters);
  if(!op.groupBy){
    const result = {}; op.metrics.forEach(m=>{ result[m]=computeMetric(filtered,m); });
    result.count = filtered.length;
    return { groupBy:null, metrics:op.metrics, result };
  }
  const groups = groupByDimension(filtered, op.groupBy);
  let rows = Array.from(groups.entries()).map(([key,grows])=>{
    const row = { key };
    op.metrics.forEach(m=>{ row[m]=computeMetric(grows,m); });
    row.count = grows.length;
    return row;
  });
  if(op.sort && op.sort.by && KNOWN_METRICS.includes(op.sort.by)){
    rows.sort((a,b)=> op.sort.dir==='asc' ? a[op.sort.by]-b[op.sort.by] : b[op.sort.by]-a[op.sort.by]);
  } else if(op.groupBy==='month'){
    rows.sort((a,b)=>MONTHS_LIST.indexOf(a.key)-MONTHS_LIST.indexOf(b.key));
  } else if(op.groupBy==='quarter'){
    rows.sort((a,b)=>a.key.localeCompare(b.key));
  }
  if(Number.isInteger(op.limit) && op.limit>0) rows=rows.slice(0,op.limit);
  return { groupBy:op.groupBy, metrics:op.metrics, rows };
}

function executePoints(data, op){
  const filtered = applyFilters(data, op.filters);
  let pts;
  if(op.groupBy){
    const groups = groupByDimension(filtered, op.groupBy);
    pts = Array.from(groups.entries()).map(([key,rows])=>({
      label:key, x:computeMetric(rows,op.x_metric), y:computeMetric(rows,op.y_metric), n:rows.length,
    }));
  } else {
    pts = filtered.map(r=>({ label:r.invoice_number, x:computeRowMetric(r,op.x_metric), y:computeRowMetric(r,op.y_metric) }));
  }
  const cap = Math.min(Number.isInteger(op.limit)&&op.limit>0 ? op.limit : 200, 300);
  if(pts.length>cap){
    const step = pts.length/cap;
    pts = Array.from({length:cap}, (_,i)=>pts[Math.floor(i*step)]);
  }
  return { x_metric:op.x_metric, y_metric:op.y_metric, groupBy:op.groupBy||null, count:pts.length, points:pts };
}

function median(sortedArr){
  const n=sortedArr.length;
  if(!n) return 0;
  return n%2 ? sortedArr[(n-1)/2] : (sortedArr[n/2-1]+sortedArr[n/2])/2;
}

function executeSegment(data, op){
  const filtered = applyFilters(data, op.filters);
  const groups = groupByDimension(filtered, op.groupBy);
  const entities = Array.from(groups.entries()).map(([key,rows])=>({
    key, x:computeMetric(rows,op.x_metric), y:computeMetric(rows,op.y_metric), count:rows.length,
  }));
  if(!entities.length) return { x_metric:op.x_metric, y_metric:op.y_metric, entities:[], bucketSummaries:[] };
  const xMed = median([...entities.map(e=>e.x)].sort((a,b)=>a-b));
  const yMed = median([...entities.map(e=>e.y)].sort((a,b)=>a-b));
  const bucketCount = [2,4].includes(op.buckets) ? op.buckets : 4;
  const xLabel = METRIC_LABEL_AR[op.x_metric]||op.x_metric;
  const yLabel = METRIC_LABEL_AR[op.y_metric]||op.y_metric;
  entities.forEach(e=>{
    if(bucketCount===4){
      const xHigh=e.x>=xMed, yHigh=e.y>=yMed;
      e.bucket = `${xHigh?'مرتفع':'منخفض'} ${xLabel} / ${yHigh?'مرتفع':'منخفض'} ${yLabel}`;
    } else {
      e.bucket = e.x>=xMed ? `مرتفع ${xLabel}` : `منخفض ${xLabel}`;
    }
  });
  const byBucket = new Map();
  entities.forEach(e=>{ if(!byBucket.has(e.bucket)) byBucket.set(e.bucket,[]); byBucket.get(e.bucket).push(e); });
  const bucketSummaries = Array.from(byBucket.entries()).map(([label,ents])=>({
    label, count:ents.length,
    avg_x: round2(ents.reduce((s,e)=>s+e.x,0)/ents.length),
    avg_y: round4(ents.reduce((s,e)=>s+e.y,0)/ents.length),
    sample_members: ents.slice(0,8).map(e=>e.key),
  }));
  return { x_metric:op.x_metric, y_metric:op.y_metric, x_median:round2(xMed), y_median:round4(yMed), entity_count:entities.length, entities, bucketSummaries };
}

function executeOperation(data, op){
  const err = validateOp(op);
  if(err) return { error: err };
  if(op.type==='aggregate') return executeAggregate(data, op);
  if(op.type==='points') return executePoints(data, op);
  if(op.type==='segment') return executeSegment(data, op);
  return { error: 'unreachable' };
}

function executePlanOperations(data, plan){
  if(!plan || !Array.isArray(plan.operations) || !plan.operations.length){
    throw new Error('Query plan has no operations array.');
  }
  const results = {};
  for(const op of plan.operations){
    const r = executeOperation(data, op);
    if(r && r.error) throw new Error(`Operation "${op && op.name}" invalid: ${r.error}`);
    results[op.name] = r;
  }
  return results;
}

if (typeof module !== 'undefined') {
  module.exports = {
    generateDataset, executePlanOperations, executeOperation, validateOp,
    KNOWN_DIMENSIONS, KNOWN_METRICS, KNOWN_OP_TYPES, CITIES_LIST, SEGMENTS_LIST, MONTHS_LIST,
  };
}
