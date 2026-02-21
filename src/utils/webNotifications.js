// Web Notifications utility
// Requests permission and sends browser notifications for alerts

export function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications');
        return Promise.resolve(false);
    }

    if (Notification.permission === 'granted') {
        return Promise.resolve(true);
    }

    if (Notification.permission === 'denied') {
        return Promise.resolve(false);
    }

    return Notification.requestPermission().then(permission => {
        return permission === 'granted';
    });
}

export function sendWebNotification(title, body, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    const notification = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: options.tag || 'guardianlink',
        ...options
    });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
}

// Check for new notifications and trigger browser alerts
export function checkAndNotify(notifications, previousCount) {
    if (notifications.length > previousCount) {
        const newCount = notifications.length - previousCount;
        const latest = notifications[0];

        sendWebNotification(
            'GuardianLink Alert',
            latest.message || `You have ${newCount} new notification(s)`,
            { tag: `gl-${Date.now()}` }
        );
    }
    return notifications.length;
}
