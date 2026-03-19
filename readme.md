FACTORY-MANAGEMENT-BE FOLDER STRUCTURE
├─ src/
│  ├─ controllers/      # Route handlers
│  ├─ routes/           # Express routes
│  ├─ middleware/       # Custom middleware
│  ├─ models/           # Database models (if any)
│  ├─ utils/            # Utility functions
│  ├─ config/           # Configuration (DB, env, etc.)
│  ├─ app.js            # Express app initialization
│  └─ server.js         # Server entry point
├─ node_modules/
├─ package.json
├─ .env                 # Environment variables
└─ .gitignore

 POST http://ip:port/v1/connect
 {"sn":"sjfljfdsjfds"}

 http://ip:port/v1/add
 http://ip:port/v1/delete
 http://ip:port/v1/query
 http://ip:port/v1/check_registration
 http://ip:port/v1/query_images
 http://ip:port/v1/firmware_upgrade
 http://ip:port/v1/pass_list
 http://ip:port/v1/query_batch_import_path
 

 - remote group add delete option
 - make sn number unique
 - time group also add del option
 - make remote group sn,name
 - assign time group more that remote only one time group
 
 report
 access log - group report 
 time - 

 - 