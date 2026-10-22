-- Canonical, complete business schema for Everyday Essentials Retail.
-- Append every schema change here and register its version in schema_migrations.
create schema if not exists business;
create extension if not exists pgcrypto;
create table if not exists business.schema_migrations (version text primary key, description text not null, applied_at timestamptz not null default now());
create table if not exists business.profiles (id text primary key, name text not null, role text not null check (role in ('Owner','Cashier')), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists business.access_codes (id uuid primary key default gen_random_uuid(), profile_id text not null references business.profiles(id) on delete cascade, hashed_code text not null, active boolean not null default true, created_at timestamptz not null default now(), last_used_at timestamptz);
create index if not exists access_codes_active_idx on business.access_codes(active) where active;
create table if not exists business.products (
  id text primary key, name text not null, sku text not null unique, category text not null,
  description text not null default '', barcode text not null default '', cost_price numeric(12,2) not null,
  selling_price numeric(12,2) not null, stock integer not null default 0, reorder_level integer not null default 0,
  archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists business.customers (
  id text primary key, name text not null, phone text not null default '', email text not null default '', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists business.suppliers (
  id text primary key, name text not null, phone text not null default '', email text not null default '', address text not null default '',
  notes text not null default '', archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists business.sales (
  id text primary key, reference text not null unique, created_at timestamptz not null, customer_id text references business.customers(id) on delete set null,
  customer_name text not null, cashier text not null, subtotal numeric(12,2) not null, discount numeric(12,2) not null default 0,
  total numeric(12,2) not null, payment_method text not null check (payment_method in ('Cash','Mobile Money','Card','Bank Transfer','Other')),
  amount_received numeric(12,2) not null default 0, change_amount numeric(12,2) not null default 0,
  status text not null check (status in ('Completed','Refunded'))
);
create index if not exists sales_created_at_idx on business.sales(created_at desc);
create table if not exists business.sale_items (
  id bigint generated always as identity primary key, sale_id text not null references business.sales(id) on delete cascade,
  product_id text not null references business.products(id) on delete restrict, name text not null, sku text not null,
  quantity integer not null check (quantity > 0), unit_price numeric(12,2) not null, unit_cost numeric(12,2) not null
);
create index if not exists sale_items_sale_id_idx on business.sale_items(sale_id);
create table if not exists business.inventory_movements (
  id text primary key, product_id text not null references business.products(id) on delete restrict, product_name text not null,
  type text not null, quantity integer not null, balance integer not null, reference text not null default '', reason text not null default '',
  user_name text not null, created_at timestamptz not null
);
create index if not exists inventory_movements_created_at_idx on business.inventory_movements(created_at desc);
create table if not exists business.purchases (
  id text primary key, reference text not null unique, supplier_id text not null references business.suppliers(id) on delete restrict,
  supplier_name text not null, created_at timestamptz not null, total numeric(12,2) not null, amount_paid numeric(12,2) not null default 0,
  status text not null check (status in ('Received','Partially received','Pending'))
);
create table if not exists business.purchase_items (
  id bigint generated always as identity primary key, purchase_id text not null references business.purchases(id) on delete cascade,
  product_id text not null references business.products(id) on delete restrict, name text not null,
  quantity integer not null check (quantity > 0), received integer not null default 0, unit_cost numeric(12,2) not null
);
create index if not exists purchase_items_purchase_id_idx on business.purchase_items(purchase_id);
create table if not exists business.expenses (
  id text primary key, title text not null, category text not null, amount numeric(12,2) not null,
  date timestamptz not null, payment_method text not null check (payment_method in ('Cash','Mobile Money','Card','Bank Transfer','Other')),
  status text not null check (status in ('Paid','Unpaid')), notes text not null default '', reference text not null default ''
);
create index if not exists expenses_date_idx on business.expenses(date desc);
create table if not exists business.categories (
  name text primary key, sort_order integer not null default 0
);
create table if not exists business.expense_categories (
  name text primary key, sort_order integer not null default 0
);
create table if not exists business.business_settings (
  id integer primary key check (id = 1), name text not null, phone text not null default '', email text not null default '',
  address text not null default '', receipt_footer text not null default '', currency text not null default 'GHS',
  timezone text not null default 'Africa/Accra', low_stock_threshold integer not null default 10, updated_at timestamptz not null default now()
);

create or replace function business.replace_retail_data(p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = business, pg_temp
as $function$
declare
  item jsonb;
begin
  insert into products(id,name,sku,category,description,barcode,cost_price,selling_price,stock,reorder_level,archived)
  select id,name,sku,category,coalesce(description,''),coalesce(barcode,''),"costPrice","sellingPrice",stock,"reorderLevel",coalesce(archived,false)
  from jsonb_to_recordset(coalesce(p_data->'products','[]'::jsonb)) as x(id text,name text,sku text,category text,description text,barcode text,"costPrice" numeric,"sellingPrice" numeric,stock integer,"reorderLevel" integer,archived boolean)
  on conflict(id) do update set name=excluded.name,sku=excluded.sku,category=excluded.category,description=excluded.description,barcode=excluded.barcode,cost_price=excluded.cost_price,selling_price=excluded.selling_price,stock=excluded.stock,reorder_level=excluded.reorder_level,archived=excluded.archived,updated_at=now();

  insert into customers(id,name,phone,email,notes)
  select id,name,coalesce(phone,''),coalesce(email,''),coalesce(notes,'')
  from jsonb_to_recordset(coalesce(p_data->'customers','[]'::jsonb)) as x(id text,name text,phone text,email text,notes text)
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,notes=excluded.notes,updated_at=now();

  insert into suppliers(id,name,phone,email,address,notes,archived)
  select id,name,coalesce(phone,''),coalesce(email,''),coalesce(address,''),coalesce(notes,''),coalesce(archived,false)
  from jsonb_to_recordset(coalesce(p_data->'suppliers','[]'::jsonb)) as x(id text,name text,phone text,email text,address text,notes text,archived boolean)
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,address=excluded.address,notes=excluded.notes,archived=excluded.archived,updated_at=now();

  insert into categories(name,sort_order)
  select value,ordinality::integer from jsonb_array_elements_text(coalesce(p_data->'categories','[]'::jsonb)) with ordinality as x(value,ordinality)
  on conflict(name) do update set sort_order=excluded.sort_order;
  insert into expense_categories(name,sort_order)
  select value,ordinality::integer from jsonb_array_elements_text(coalesce(p_data->'expenseCategories','[]'::jsonb)) with ordinality as x(value,ordinality)
  on conflict(name) do update set sort_order=excluded.sort_order;

  insert into business_settings(id,name,phone,email,address,receipt_footer,currency,timezone,low_stock_threshold)
  values(1,p_data->'settings'->>'name',coalesce(p_data->'settings'->>'phone',''),coalesce(p_data->'settings'->>'email',''),coalesce(p_data->'settings'->>'address',''),coalesce(p_data->'settings'->>'receiptFooter',''),coalesce(p_data->'settings'->>'currency','GHS'),coalesce(p_data->'settings'->>'timezone','Africa/Accra'),coalesce((p_data->'settings'->>'lowStockThreshold')::integer,10))
  on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,address=excluded.address,receipt_footer=excluded.receipt_footer,currency=excluded.currency,timezone=excluded.timezone,low_stock_threshold=excluded.low_stock_threshold,updated_at=now();

  for item in select value from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) as x(value) loop
    insert into sales(id,reference,created_at,customer_id,customer_name,cashier,subtotal,discount,total,payment_method,amount_received,change_amount,status)
    values(item->>'id',item->>'reference',(item->>'createdAt')::timestamptz,nullif(item->>'customerId','') ,item->>'customerName',item->>'cashier',(item->>'subtotal')::numeric,(item->>'discount')::numeric,(item->>'total')::numeric,item->>'paymentMethod',(item->>'amountReceived')::numeric,(item->>'change')::numeric,item->>'status')
    on conflict(id) do update set reference=excluded.reference,created_at=excluded.created_at,customer_id=excluded.customer_id,customer_name=excluded.customer_name,cashier=excluded.cashier,subtotal=excluded.subtotal,discount=excluded.discount,total=excluded.total,payment_method=excluded.payment_method,amount_received=excluded.amount_received,change_amount=excluded.change_amount,status=excluded.status;
    delete from sale_items where sale_id=item->>'id';
    insert into sale_items(sale_id,product_id,name,sku,quantity,unit_price,unit_cost)
    select item->>'id',"productId",name,sku,quantity,"unitPrice","unitCost"
    from jsonb_to_recordset(coalesce(item->'items','[]'::jsonb)) as x("productId" text,name text,sku text,quantity integer,"unitPrice" numeric,"unitCost" numeric);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_data->'purchases','[]'::jsonb)) as x(value) loop
    insert into purchases(id,reference,supplier_id,supplier_name,created_at,total,amount_paid,status)
    values(item->>'id',item->>'reference',item->>'supplierId',item->>'supplierName',(item->>'createdAt')::timestamptz,(item->>'total')::numeric,(item->>'amountPaid')::numeric,item->>'status')
    on conflict(id) do update set reference=excluded.reference,supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,created_at=excluded.created_at,total=excluded.total,amount_paid=excluded.amount_paid,status=excluded.status;
    delete from purchase_items where purchase_id=item->>'id';
    insert into purchase_items(purchase_id,product_id,name,quantity,received,unit_cost)
    select item->>'id',"productId",name,quantity,received,"unitCost"
    from jsonb_to_recordset(coalesce(item->'items','[]'::jsonb)) as x("productId" text,name text,quantity integer,received integer,"unitCost" numeric);
  end loop;

  insert into inventory_movements(id,product_id,product_name,type,quantity,balance,reference,reason,user_name,created_at)
  select id,"productId","productName",type,quantity,balance,coalesce(reference,''),coalesce(reason,''),"user",("createdAt")::timestamptz
  from jsonb_to_recordset(coalesce(p_data->'movements','[]'::jsonb)) as x(id text,"productId" text,"productName" text,type text,quantity integer,balance integer,reference text,reason text,"user" text,"createdAt" text)
  on conflict(id) do update set product_id=excluded.product_id,product_name=excluded.product_name,type=excluded.type,quantity=excluded.quantity,balance=excluded.balance,reference=excluded.reference,reason=excluded.reason,user_name=excluded.user_name,created_at=excluded.created_at;

  insert into expenses(id,title,category,amount,date,payment_method,status,notes,reference)
  select id,title,category,amount,(date)::timestamptz,"paymentMethod",status,coalesce(notes,''),coalesce(reference,'')
  from jsonb_to_recordset(coalesce(p_data->'expenses','[]'::jsonb)) as x(id text,title text,category text,amount numeric,date text,"paymentMethod" text,status text,notes text,reference text)
  on conflict(id) do update set title=excluded.title,category=excluded.category,amount=excluded.amount,date=excluded.date,payment_method=excluded.payment_method,status=excluded.status,notes=excluded.notes,reference=excluded.reference;

  delete from sale_items where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) as s(value) where s.value->>'id'=sale_items.sale_id);
  delete from sales where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'sales','[]'::jsonb)) as s(value) where s.value->>'id'=sales.id);
  delete from purchase_items where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'purchases','[]'::jsonb)) as s(value) where s.value->>'id'=purchase_items.purchase_id);
  delete from purchases where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'purchases','[]'::jsonb)) as s(value) where s.value->>'id'=purchases.id);
  delete from inventory_movements where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'movements','[]'::jsonb)) as s(value) where s.value->>'id'=inventory_movements.id);
  delete from expenses where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'expenses','[]'::jsonb)) as s(value) where s.value->>'id'=expenses.id);
  delete from customers where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'customers','[]'::jsonb)) as s(value) where s.value->>'id'=customers.id);
  delete from suppliers where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'suppliers','[]'::jsonb)) as s(value) where s.value->>'id'=suppliers.id);
  delete from products where not exists(select 1 from jsonb_array_elements(coalesce(p_data->'products','[]'::jsonb)) as s(value) where s.value->>'id'=products.id);
  delete from categories where not exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'categories','[]'::jsonb)) as c(value) where c.value=categories.name);
  delete from expense_categories where not exists(select 1 from jsonb_array_elements_text(coalesce(p_data->'expenseCategories','[]'::jsonb)) as c(value) where c.value=expense_categories.name);
end;
$function$;

grant select, insert, update, delete on all tables in schema business to service_role;
grant usage, select on all sequences in schema business to service_role;
revoke all on function business.replace_retail_data(jsonb) from public, anon, authenticated;
grant execute on function business.replace_retail_data(jsonb) to service_role;


grant select, insert, update, delete on all tables in schema business to service_role;
grant usage, select on all sequences in schema business to service_role;
revoke all on function business.replace_retail_data(jsonb) from public, anon, authenticated;
grant execute on function business.replace_retail_data(jsonb) to service_role;
revoke all on schema business from public, anon, authenticated;
grant usage on schema business to service_role;
insert into business.schema_migrations(version,description) values ('0001','Create business authentication schema'),('0002','Normalize retail records into relational tables') on conflict(version) do update set description=excluded.description;
notify pgrst, 'reload schema';
