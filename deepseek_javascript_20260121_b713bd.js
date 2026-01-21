class WebRTCHandler {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.socket = null;
    this.roomId = null;
    this.callType = null;
    this.isCaller = false;
    this.iceCandidates = [];
  }

  // Initialize WebRTC
  async initializeWebRTC(socket, roomId, isCaller, callType = 'audio') {
    this.socket = socket;
    this.roomId = roomId;
    this.isCaller = isCaller;
    this.callType = callType;

    // Create RTCPeerConnection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Get local media stream
    try {
      const constraints = {
        audio: true,
        video: callType === 'video'
      };
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Add tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Get remote stream
      this.remoteStream = new MediaStream();
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
      };

    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }

    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          roomId: this.roomId,
          candidate: event.candidate
        });
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      
      if (this.peerConnection.connectionState === 'connected') {
        console.log('WebRTC connection established');
      } else if (this.peerConnection.connectionState === 'disconnected' ||
                 this.peerConnection.connectionState === 'failed') {
        console.log('WebRTC connection failed');
        this.cleanup();
      }
    };

    // Setup socket listeners
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    // Handle incoming offer
    this.socket.on('offer', async ({ offer, callerId }) => {
      if (!this.isCaller) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Create and send answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.socket.emit('answer', {
          roomId: this.roomId,
          answer: answer,
          calleeId: this.socket.userId
        });
      }
    });

    // Handle incoming answer
    this.socket.on('answer', async ({ answer }) => {
      if (this.isCaller) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Handle ICE candidates
    this.socket.on('ice-candidate', async (candidate) => {
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    // Handle call ended
    this.socket.on('call-ended', ({ endedBy }) => {
      console.log(`Call ended by ${endedBy}`);
      this.cleanup();
    });
  }

  // Start call (for caller)
  async startCall() {
    if (!this.isCaller || !this.peerConnection) return;

    try {
      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callType === 'video'
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      // Send offer via socket
      this.socket.emit('offer', {
        roomId: this.roomId,
        offer: offer,
        callerId: this.socket.userId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  // Toggle audio mute
  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  // Toggle video
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  // Switch camera
  async switchCamera() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length < 2) return;

    const currentDeviceId = videoTrack.getSettings().deviceId;
    const newDevice = videoDevices.find(device => device.deviceId !== currentDeviceId);
    
    if (newDevice) {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: newDevice.deviceId } },
        audio: true
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        sender.replaceTrack(newVideoTrack);
      }

      // Replace local stream track
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      videoTrack.stop();
    }
  }

  // Screen sharing
  async toggleScreenShare() {
    try {
      if (!this.isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track with screen track
        const sender = this.peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        // Store original track
        this.originalVideoTrack = this.localStream.getVideoTracks()[0];
        this.isScreenSharing = true;
        
        // Handle when user stops screen sharing
        screenTrack.onended = () => {
          this.stopScreenShare();
        };

        this.screenStream = screenStream;
      } else {
        this.stopScreenShare();
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }

  stopScreenShare() {
    if (this.isScreenSharing && this.originalVideoTrack) {
      const sender = this.peerConnection.getSenders().find(s => 
        s.track && s.track.kind === 'video'
      );
      
      if (sender) {
        sender.replaceTrack(this.originalVideoTrack);
      }

      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }

      this.isScreenSharing = false;
    }
  }

  // End call
  endCall() {
    if (this.socket) {
      this.socket.emit('end-call', {
        roomId: this.roomId,
        userId: this.socket.userId
      });
    }
    this.cleanup();
  }

  // Cleanup resources
  cleanup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;
    this.iceCandidates = [];
  }

  // Get local and remote streams
  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  // Get connection stats
  async getConnectionStats() {
    if (!this.peerConnection) return null;

    const stats = await this.peerConnection.getStats();
    const result = {};

    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        result.audio = {
          packetsReceived: report.packetsReceived,
          packetsLost: report.packetsLost,
          jitter: report.jitter,
          latency: report.roundTripTime
        };
      } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        result.audioSent = {
          packetsSent: report.packetsSent,
          bytesSent: report.bytesSent
        };
      }
    });

    return result;
  }
}

export default WebRTCHandler;