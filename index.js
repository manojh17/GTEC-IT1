import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import path from "path";
import moment from "moment-timezone";
import multer from "multer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;
moment.tz.setDefault("Asia/Kolkata");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));
app.use(bodyParser.json());
app.use(session({
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

app.get('/posting', (req, res) => {
  res.sendFile(join(__dirname, './public/update.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(join(__dirname, './public/dashboard.html'));
});

app.get("/attendence", isAuthenticated, (req, res) => {
  let page;
  if (req.session.userType === 'student') {
    page = 'student.html';
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
        page = 'attendence-faculty.html';
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
    const announcements = JSON.parse(data);
    res.json(announcements);
  } catch (error) {
    console.error('Error reading announcements file:', error);
    res.status(500).send('Internal Server Error');
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
  const validatedUser = await validateUser(user, passkey);
  if (validatedUser) {
    req.session.user = validatedUser.user;
    req.session.userType = validatedUser.userType;
    let redirectPage;
    if (validatedUser.userType === 'student') {
      redirectPage = '/index.html';
    } else if (validatedUser.userType === 'teacher') {
      switch (validatedUser.user.user) {
        case 'teacher1':
          redirectPage = '/attendence-faculty2.html';
          break;
        case 'teacher2':
          redirectPage = '/attendence-faculty3.html';
          break;
        case 'teacher3':
          redirectPage = '/attendence-faculty4.html';
          break;
        case 'hodit':
          redirectPage = '/full2.html';
          break;
        default:
          redirectPage = '/attendence-faculty.html';
      }
    }
    res.json({ message: 'Login successful', redirect: redirectPage });
  } else {
    res.json({ message: 'Invalid username or password' });
  }
});

// Function to read JSON data
const readJSONData = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file from disk: ${error}`);
    return null;
  }
};

// API endpoint to fetch attendance data
app.get('/attendance-data', async (req, res) => {
  const { page, date } = req.query;
  let filePath = '';

  // Determine which file to read based on the 'page' parameter
  switch (page) {
    case 'todayone':
      filePath = path.join(__dirname, 'public', 'db2.json');
      break;
    case 'todaytwo':
      filePath = path.join(__dirname, 'public', 'db3.json');
      break;
    case 'todaythree':
      filePath = path.join(__dirname, 'public', 'db4.json');
      break;
    default:
      return res.status(400).send('Invalid page parameter');
  }

  const data = await readJSONData(filePath);
  if (data) {
    const attendanceData = data[date] || [];
    res.json(attendanceData);
  } else {
    res.status(500).send('Error reading data');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Failed to log out.');
    }
    res.redirect('/');
  });
});

// Route to save announcements
app.post('/save-announcement', isAuthenticated, upload.single('image'), async (req, res) => {
  const { title, text, link } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '';
  const username = req.session.user.user; // Get the username from the session

  const newAnnouncement = {
    title,
    text,
    link,
    image,
    date: new Date().toISOString(),
    username // Include the username
  };

  const filePath = path.join(__dirname, 'public', 'updates', 'update.json');

  // Read existing announcements
  let announcements = [];
  try {
    const data = await fs.readFile(filePath, 'utf8');
    announcements = JSON.parse(data);
  } catch (error) {
    console.error('Error reading file:', error);
  }

  // Add the new announcement
  announcements.push(newAnnouncement);

  // Save the updated announcements
  await fs.writeFile(filePath, JSON.stringify(announcements, null, 2));

  res.redirect('/posting');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
