# @codenameryuu/adonis-datatable

Adonis datatable is an inspiration from laravel datatable. It is heavily inspired by the PHP library [Laravel Datatables](https://yajrabox.com/docs/laravel-datatables) and even share some code with services, facade and dependency injection.

## Requirement

* Adonis Js 6
* Jquery datatable

## Installation

```bash
node ace add @codenameryuu/adonis-datatable
```

## Usage

1. Lucid Datatable - Via Service

```typescript
import datatables from '@codenameryuu/adonis-datatable/services/main'
import LucidDataTable from '@codenameryuu/adonis-datatable/engines/lucid_datatable'

import User from '#models/user'

const user = User.query()

const datatable = await datatables
  .of<LucidDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

2. Lucid Datatable - Via Factory (Recomended)

```typescript
import { Datatables } from '@codenameryuu/adonis-datatable'

import User from '#models/user'

const user = User.query()

const datatable = await Datatables.lucid(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

3. Lucid Datatable - Via Engine

```typescript
import LucidDataTable from '@codenameryuu/adonis-datatable/engines/lucid_datatable'

import User from '#models/user'

const user = User.query()

const datatable = await new LucidDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

4. Database Datatable - Via Service

```typescript
import db from '@adonisjs/lucid/services/db'
import datatables from '@codenameryuu/adonis-datatable/services/main'
import DatabaseDataTable from '@codenameryuu/adonis-datatable/engines/database_datatable'

const user = db.from('users').select('*')

const datatable = await datatables
  .of<DatabaseDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

5. Database Datatable - Via Factory

```typescript
import db from '@adonisjs/lucid/services/db'
import { Datatables } from '@codenameryuu/adonis-datatable'

const user = db.from('users').select('*')

const datatable = await Datatables.database(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

6. Database Datatable - Via Engine

```typescript
import db from '@adonisjs/lucid/services/db'
import DatabaseDataTable from '@codenameryuu/adonis-datatable/engines/database_datatable'

const user = db.from('users').select('*')

const datatable = await new DatabaseDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

7. Object Datatable - Via Service

```typescript
import datatables from '@codenameryuu/adonis-datatable/services/main'
import ObjectDataTable from '@codenameryuu/adonis-datatable/engines/object_datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await datatables
  .of<ObjectDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

8. Object Datatable - Via Factory

```typescript
import { Datatables } from '@codenameryuu/adonis-datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await Datatables.object(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

9. Object Datatable - Via Engine

```typescript
import ObjectDataTable from '@codenameryuu/adonis-datatable/engines/object_datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await new ObjectDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

## License

This package is open-sourced software licensed under the [MIT license](LICENSE.md).
