# User Wiegand API Examples

## Base URL
```
http://localhost:3000/api
```

## 1. Add Multiple User Assignments

**Endpoint:** `POST /user_wiegands`

**Request:**
```bash
curl -X POST http://localhost:3000/api/user_wiegands \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "sn": "device001",
    "user_id": "user1",
    "assignments": [
      {
        "group_id": "gr1",
        "time_group_id": "tr1"
      },
      {
        "group_id": "gr1",
        "time_group_id": "tr2"
      },
      {
        "group_id": "gr2",
        "time_group_id": "tr1"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 3 assignments",
  "summary": {
    "total_assignments": 3,
    "inserted": 3,
    "skipped": 0,
    "errors": 0
  },
  "data": [
    {
      "id": 1,
      "sn": "device001",
      "user_id": "user1",
      "group_id": "gr1",
      "time_group_id": "tr1",
      "timestamp": 1640995200000,
      "del_flag": false
    },
    {
      "id": 2,
      "sn": "device001",
      "user_id": "user1",
      "group_id": "gr1",
      "time_group_id": "tr2",
      "timestamp": 1640995200000,
      "del_flag": false
    },
    {
      "id": 3,
      "sn": "device001",
      "user_id": "user1",
      "group_id": "gr2",
      "time_group_id": "tr1",
      "timestamp": 1640995200000,
      "del_flag": false
    }
  ]
}
```

## 3. Delete Single Assignment by ID

**Endpoint:** `DELETE /user_wiegands/:id`

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/user_wiegands/b501a907-414d-4261-8488-b63fae649962 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "message": "User Wiegand soft deleted successfully",
  "data": {
    "id": "b501a907-414d-4261-8488-b63fae649962",
    "sn": "device001",
    "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
    "group_id": "gd001",
    "time_group_id": "TG002",
    "timestamp": "1773997113964",
    "del_flag": true
  }
}
```

## 4. Delete Specific Assignment by ID and User ID

**Endpoint:** `DELETE /user_wiegands/assignment`

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/user_wiegands/assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
    "id": "c7c68bb4-27ba-4e60-ab83-716766528b3b"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Assignment deleted successfully",
  "data": {
    "id": "c7c68bb4-27ba-4e60-ab83-716766528b3b",
    "sn": "device001",
    "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
    "group_id": "gd001",
    "time_group_id": "tg001",
    "timestamp": "1773997113964",
    "del_flag": true
  }
}
```

## 5. Delete All Assignments for a User

**Endpoint:** `DELETE /user_wiegands/assignment`

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/user_wiegands/assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "8c2bba23-7259-48b7-b101-589513c2fced"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully deleted 2 assignments for user 8c2bba23-7259-48b7-b101-589513c2fced",
  "deleted_count": 2,
  "data": [
    {
      "id": "2a40fd95-45a8-4ece-906e-eb7a4b59783f",
      "sn": "device001",
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "group_id": "gd002",
      "time_group_id": "tg001",
      "timestamp": "1773997113964",
      "del_flag": true
    },
    {
      "id": "b501a907-414d-4261-8488-b63fae649962",
      "sn": "device001",
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "group_id": "gd001",
      "time_group_id": "TG002",
      "timestamp": "1773997113964",
      "del_flag": true
    }
  ]
}
```

## 6. Delete Single Assignment (by user_id, sn, group_id, time_group_id) - LEGACY

**Endpoint:** `DELETE /user_wiegands/assignment`

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/user_wiegands/assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "user1",
    "sn": "device001",
    "group_id": "gr1",
    "time_group_id": "tr1"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Assignment deleted successfully",
  "data": {
    "id": 1,
    "sn": "device001",
    "user_id": "user1",
    "group_id": "gr1",
    "time_group_id": "tr1",
    "timestamp": 1640995200000,
    "del_flag": true
  }
}
```

## 3. Delete All User Assignments (Complete)

**Endpoint:** `DELETE /user_wiegands/all`

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/user_wiegands/all \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "user_id": "user1",
    "sn": "device001"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully deleted 2 assignments for user user1",
  "deleted_count": 2,
  "data": [
    {
      "id": 2,
      "sn": "device001",
      "user_id": "user1",
      "group_id": "gr1",
      "time_group_id": "tr2",
      "timestamp": 1640995200000,
      "del_flag": true
    },
    {
      "id": 3,
      "sn": "device001",
      "user_id": "user1",
      "group_id": "gr2",
      "time_group_id": "tr1",
      "timestamp": 1640995200000,
      "del_flag": true
    }
  ]
}
```

## 4. Get User Assignments (Original Flat Format)

**Endpoint:** `GET /user_wiegands`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user_wiegands?user_id=user1&limit=10&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "total_records": 3,
  "current_page": 1,
  "total_pages": 1,
  "grouped_by_user": false,
  "data": [
    {
      "id": "c7c68bb4-27ba-4e60-ab83-716766528b3b",
      "sn": "device001",
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "group_id": "gd001",
      "time_group_id": "tg001",
      "timestamp": "1773997113964",
      "del_flag": false,
      "device_name": "Main Door"
    },
    {
      "id": "2a40fd95-45a8-4ece-906e-eb7a4b59783f",
      "sn": "device001",
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "group_id": "gd002",
      "time_group_id": "tg001",
      "timestamp": "1773997113964",
      "del_flag": false,
      "device_name": "Main Door"
    },
    {
      "id": "b501a907-414d-4261-8488-b63fae649962",
      "sn": "device001",
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "group_id": "gd001",
      "time_group_id": "TG002",
      "timestamp": "1773997113964",
      "del_flag": false,
      "device_name": "Main Door"
    }
  ]
}
```

## 5. Get User Assignments (Grouped by User Format)

**Endpoint:** `GET /user_wiegands`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user_wiegands?group_by_user=true&limit=10&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "total_records": 3,
  "current_page": 1,
  "total_pages": 1,
  "grouped_by_user": true,
  "data": [
    {
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "assignments": [
        {
          "id": "c7c68bb4-27ba-4e60-ab83-716766528b3b",
          "sn": "device001",
          "group_id": "gd001",
          "time_group_id": "tg001",
          "timestamp": "1773997113964",
          "del_flag": false,
          "device_name": "Main Door"
        },
        {
          "id": "2a40fd95-45a8-4ece-906e-eb7a4b59783f",
          "sn": "device001",
          "group_id": "gd002",
          "time_group_id": "tg001",
          "timestamp": "1773997113964",
          "del_flag": false,
          "device_name": "Main Door"
        },
        {
          "id": "b501a907-414d-4261-8488-b63fae649962",
          "sn": "device001",
          "group_id": "gd001",
          "time_group_id": "TG002",
          "timestamp": "1773997113964",
          "del_flag": false,
          "device_name": "Main Door"
        }
      ],
      "total_assignments": 3
    }
  ]
}
```

## 6. Search and Filter Users (Grouped Format)

**Request:**
```bash
curl -X GET "http://localhost:3000/api/user_wiegands?search=device001&group_by_user=true&sort_by=user_id&sort_order=ASC" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "total_records": 3,
  "current_page": 1,
  "total_pages": 1,
  "grouped_by_user": true,
  "data": [
    {
      "user_id": "8c2bba23-7259-48b7-b101-589513c2fced",
      "assignments": [
        {
          "id": "c7c68bb4-27ba-4e60-ab83-716766528b3b",
          "sn": "device001",
          "group_id": "gd001",
          "time_group_id": "tg001",
          "timestamp": "1773997113964",
          "del_flag": false,
          "device_name": "Main Door"
        }
      ],
      "total_assignments": 1
    }
  ]
}
```

## Error Examples

### Invalid Assignment Data
```json
{
  "success": false,
  "message": "Each assignment must have group_id and time_group_id",
  "invalid_assignments": [
    {
      "group_id": "gr1"
    }
  ]
}
```

### Duplicate Assignment Error
```json
{
  "success": false,
  "message": "Cannot add assignments - some already exist",
  "duplicates": [
    {
      "group_id": "gr1",
      "time_group_id": "tr1",
      "reason": "Assignment already exists"
    }
  ],
  "error_code": "DUPLICATE_ASSIGNMENTS"
}
```

### Assignment Not Found
```json
{
  "success": false,
  "message": "Assignment not found or already deleted"
}
```

### No Assignments Found for User
```json
{
  "success": false,
  "message": "No assignments found for this user and device"
}
```

## Notes

1. **Authentication**: All endpoints require a valid JWT token in the `Authorization` header
2. **Authorization**: Admin and superadmin roles are required for POST, PUT, and DELETE operations
3. **Soft Delete**: All delete operations perform soft delete by setting `del_flag = true`
4. **Duplicate Prevention**: The system automatically skips duplicate assignments
5. **Validation**: The API validates that both groups and time groups exist before creating assignments
6. **Device Mapping**: The system automatically manages device_group_assignments when user assignments are created or deleted
