const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'deepseek_messenger',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  avatarColor: {
    type: DataTypes.STRING,
    defaultValue: '#0066ff'
  },
  avatarUrl: {
    type: DataTypes.STRING
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'away', 'busy'),
    defaultValue: 'offline'
  },
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Contact model
const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  contactId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Message model
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messageType: {
    type: DataTypes.ENUM('text', 'image', 'video', 'file', 'audio'),
    defaultValue: 'text'
  },
  attachmentUrl: {
    type: DataTypes.STRING
  },
  attachmentName: {
    type: DataTypes.STRING
  },
  attachmentSize: {
    type: DataTypes.INTEGER
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE
  },
  deletedForSender: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedForReceiver: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Call model
const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  callerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  callType: {
    type: DataTypes.ENUM('audio', 'video'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('initiated', 'ringing', 'ongoing', 'completed', 'missed', 'rejected'),
    defaultValue: 'initiated'
  },
  startedAt: {
    type: DataTypes.DATE
  },
  endedAt: {
    type: DataTypes.DATE
  },
  duration: {
    type: DataTypes.INTEGER // in seconds
  }
});

// File model
const File = sequelize.define('File', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Define relationships
User.hasMany(Contact, { foreignKey: 'userId', as: 'contacts' });
Contact.belongsTo(User, { foreignKey: 'contactId', as: 'contactInfo' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

User.hasMany(Call, { foreignKey: 'callerId', as: 'outgoingCalls' });
User.hasMany(Call, { foreignKey: 'receiverId', as: 'incomingCalls' });
Call.belongsTo(User, { foreignKey: 'callerId', as: 'caller' });
Call.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

User.hasMany(File, { foreignKey: 'userId', as: 'files' });
File.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

module.exports = {
  sequelize,
  User,
  Contact,
  Message,
  Call,
  File
};