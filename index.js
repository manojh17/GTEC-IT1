import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import moment from "moment-timezone";
import multer from "multer";
import FileStore from 'session-file-store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
moment.tz.setDefault("Asia/Kolkata");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));
app.use(bodyParser.json());

const SessionFileStore = FileStore(session);

const sessionsDir = join(__dirname, 'sessions');

// Ensure the sessions directory exists
fs.access(sessionsDir).catch(async () => {
  await fs.mkdir(sessionsDir, { recursive: true });
});

app.use(session({
  store: new SessionFileStore({
    path: sessionsDir,
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Set up storage engine for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ensure the updates directory exists
const updatesDir = path.join(__dirname, 'public', 'updates');
if (!await fs.access(updatesDir).then(() => false).catch(() => true)) {
  await fs.mkdir(updatesDir, { recursive: true });
}

// Load and save credentials functions for students and teachers
const loadCredentials = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data).credentials;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    } else {
      throw err;
    }
  }
};

const validateUser = async (inputUser, inputPasskey) => {
  const studentFilePath = './public/studentCredentials.json';
  const teacherFilePath = './public/teacherCredentials.json';

  const studentCredentials = await loadCredentials(studentFilePath);
  const teacherCredentials = await loadCredentials(teacherFilePath);

  const student = studentCredentials.find(cred => cred.user === inputUser && cred.passkey === inputPasskey);
  if (student) return { userType: 'student', user: student };

  const teacher = teacherCredentials.find(cred => cred.user === inputUser && cred.passkey === inputPasskey);
  if (teacher) return { userType: 'teacher', user: teacher };

  return null;
};

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.get('/login', (req, res) => {
  res.sendFile(join(__dirname, './public/signin.html'));
});

app.get('/logi', (req, res) => {
  res.sendFile(join(__dirname, './public/annou.html'));
});

app.get('/createpost', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/announcements.html'));
});

app.get('/posting', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/update.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/dashboard.html'));
});

app.get("/attendence", isAuthenticated, (req, res) => {
  let page;
  if (req.session.userType === 'student') {
    page = 'dashboard.html';
  } else if (req.session.userType === 'teacher') {
    const teacherUser = req.session.user.user;
    switch (teacherUser) {
      case 'teacher1':
        page = 'attendence-faculty2.html';
        break;
      case 'teacher2':
        page = 'attendence-faculty3.html';
        break;
      case 'teacher3':
        page = 'attendence-faculty4.html';
        break;
      default:
        page = 'announcements.html';
    }
  }
  res.sendFile(join(__dirname, `./public/${page}`));
});

app.get("/curriculum", isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/dashboard.html'));
});

// Route to fetch announcements
app.get('/api/announcements', async (req, res) => {
  const filePath = path.join(__dirname, 'public', 'updates', 'update.json');
  try {
    const data = await fs.readFile(filePath, 'utf8');
    let announcements = JSON.parse(data);

    // If the user is a teacher, set a flag indicating that the announcement can be deleted
    if (req.session.userType === 'teacher') {
      announcements = announcements.map(announcement => ({
        ...announcement,
        deletable: true
      }));
    }

    res.json(announcements);
  } catch (error) {
    console.error('Error reading announcements file:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to delete an announcement
app.post('/delete-announcement', isAuthenticated, async (req, res) => {
  if (req.session.userType === 'teacher') {
    const { announcementId } = req.body;
    const filePath = path.join(__dirname, 'public', 'updates', 'update.json');

    try {
      const data = await fs.readFile(filePath, 'utf8');
      let announcements = JSON.parse(data);

      // Filter out the announcement with the provided ID
      announcements = announcements.filter(announcement => announcement.id !== announcementId);

      // Write the updated announcements back to the file
      await fs.writeFile(filePath, JSON.stringify(announcements, null, 2));

      res.status(200).send('Announcement deleted successfully');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(403).send('Unauthorized');
  }
});

// Routes to save attendance and absence data
app.post('/saveAttendance2', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db2.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAttendance3', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db3.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/saveAttendance4', async (req, res) => {
  try {
    const attendanceData = req.body;
    const currentDate = moment().format('YYYY-MM-DD');
    const filePath = path.join(__dirname, 'public', 'db4.json');

    let existingData = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(data);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    const newData = {
      ...existingData,
      [currentDate]: attendanceData
    };

    await fs.writeFile(filePath, JSON.stringify(newData, null, 2));

    res.status(200).send('Attendance data saved successfully');
  } catch (error) {
    console.error('Error saving attendance data:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  const { user, passkey } = req.body;

  try {
    const validatedUser = await validateUser(user, passkey);
    if (validatedUser) {
      req.session.user = validatedUser.user;
      req.session.userType = validatedUser.userType;

      if (validatedUser.userType === 'student') {
        res.redirect('/dashboard');
      } else if (validatedUser.userType === 'teacher') {
        res.redirect('/createpost');
      } else {
        res.status(400).send('Invalid user type');
      }
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    console.error('Error validating user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle post creation
app.post('/createpost', upload.single('file'), isAuthenticated, async (req, res) => {
  const { title, content, date } = req.body;

  // Read existing announcements
  const filePath = path.join(__dirname, 'public', 'updates', 'update.json');
  let announcements = [];
  try {
    const data = await fs.readFile(filePath, 'utf8');
    announcements = JSON.parse(data);
  } catch (error) {
    console.error('Error reading announcements file:', error);
  }

  const newAnnouncement = {
    id: moment().valueOf(), // Use a timestamp as a unique ID
    title,
    content,
    date,
    deletable: true // All announcements are deletable by default
  };

  // Add the new announcement to the list
  announcements.push(newAnnouncement);

  // Save the updated announcements
  try {
    await fs.writeFile(filePath, JSON.stringify(announcements, null, 2));
    res.status(200).send('Announcement created successfully');
  } catch (error) {
    console.error('Error writing announcements file:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
