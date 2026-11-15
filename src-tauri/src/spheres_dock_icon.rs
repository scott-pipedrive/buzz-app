//! Draw the Spheres Dock tile while the application is running.
use std::{cell::RefCell, ptr::NonNull, time::Instant};

use block2::RcBlock;
use objc2::{rc::Retained, AllocAnyThread, MainThreadMarker};
use objc2_app_kit::{
    NSApplication, NSDockTile, NSEvent, NSImage, NSImageScaling, NSImageView, NSScreen, NSWorkspace,
};
use objc2_foundation::{NSData, NSPoint, NSRect, NSRunLoop, NSRunLoopCommonModes, NSSize, NSTimer};

const FACE: &[u8] = include_bytes!("../icons/spheres/dock-face.png");
const EYE: &[u8] = include_bytes!("../icons/spheres/dock-eye.png");

thread_local! {
    static TILE: RefCell<Option<AnimatedTile>> = const { RefCell::new(None) };
}

struct AnimatedTile {
    tile: Retained<NSDockTile>,
    view: Retained<NSImageView>,
    eyes: [Retained<NSImageView>; 2],
    workspace: Retained<NSWorkspace>,
    started: Instant,
    previous: Instant,
    cursor: Option<NSPoint>,
    target: [f64; 2],
    look: [f64; 2],
    rendered: Option<([f64; 2], f64, NSSize)>,
}

fn image_view(mtm: MainThreadMarker, image: &NSImage) -> Retained<NSImageView> {
    let view = NSImageView::initWithFrame(
        mtm.alloc(),
        NSRect::new(NSPoint::ZERO, NSSize::new(128.0, 128.0)),
    );
    view.setImage(Some(image));
    view.setImageScaling(NSImageScaling::ScaleAxesIndependently);
    view
}

pub(crate) fn install() {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let Some(face) = NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(FACE)) else {
        return;
    };
    let Some(eye) = NSImage::initWithData(NSImage::alloc(), &NSData::with_bytes(EYE)) else {
        return;
    };
    let tile = NSApplication::sharedApplication(mtm).dockTile();
    let view = image_view(mtm, &face);
    let eyes = [image_view(mtm, &eye), image_view(mtm, &eye)];
    for eye in &eyes {
        view.addSubview(eye);
    }
    tile.setContentView(Some(&view));
    let now = Instant::now();
    let mut avatar = AnimatedTile {
        tile,
        view,
        eyes,
        workspace: NSWorkspace::sharedWorkspace(),
        started: now,
        previous: now,
        cursor: None,
        target: [0.0; 2],
        look: [0.0; 2],
        rendered: None,
    };
    avatar.render(1.0);
    TILE.with(|tile| tile.replace(Some(avatar)));

    let update = RcBlock::new(|_: NonNull<NSTimer>| {
        if let Some(mtm) = MainThreadMarker::new() {
            TILE.with(|tile| {
                if let Some(avatar) = tile.borrow_mut().as_mut() {
                    avatar.tick(mtm);
                }
            });
        }
    });
    // The main run loop owns the timer. The block accesses AppKit objects only
    // through main-thread storage, and holds no reference to the timer.
    let timer = unsafe { NSTimer::timerWithTimeInterval_repeats_block(1.0 / 30.0, true, &update) };
    timer.setTolerance(0.004);
    unsafe { NSRunLoop::mainRunLoop().addTimer_forMode(&timer, NSRunLoopCommonModes) };
}

impl AnimatedTile {
    fn tick(&mut self, mtm: MainThreadMarker) {
        let now = Instant::now();
        let step = (now - self.previous).as_secs_f64().min(0.1);
        self.previous = now;
        if self.workspace.accessibilityDisplayShouldReduceMotion() {
            self.cursor = None;
            self.look = [0.0; 2];
            self.render(1.0);
            return;
        }

        let cursor = NSEvent::mouseLocation();
        if self.cursor != Some(cursor) {
            self.cursor = Some(cursor);
            self.target = dock_direction(mtm, cursor);
        }
        let ease = 1.0 - (-step / 0.12).exp();
        for (position, target) in self.look.iter_mut().zip(self.target) {
            *position += (target - *position) * ease;
        }
        let blink = (1.0 - ((self.started.elapsed().as_secs_f64() % 4.8 - 4.57) / 0.11).abs())
            .clamp(0.0, 1.0);
        self.render(1.0 - 0.87 * blink * blink);
    }

    fn render(&mut self, openness: f64) {
        let size = self.tile.size();
        if self.rendered.is_some_and(|(look, open, old_size)| {
            size == old_size
                && (openness - open).abs() < 0.015
                && (self.look[0] - look[0]).abs() < 0.012
                && (self.look[1] - look[1]).abs() < 0.012
        }) {
            return;
        }
        let side = size.width.min(size.height).max(1.0);
        self.view.setFrameSize(size);
        let width = side * 0.063;
        let height = side * 0.145 * openness;
        for (eye, x) in self.eyes.iter().zip([0.412, 0.588]) {
            let center_x = size.width * 0.5 + side * (x - 0.5 + self.look[0] * 0.095);
            let center_y = size.height * 0.5 + side * (0.008 + self.look[1] * 0.08);
            eye.setFrame(NSRect::new(
                NSPoint::new(center_x - width / 2.0, center_y - height / 2.0),
                NSSize::new(width, height),
            ));
        }
        self.tile.display();
        self.rendered = Some((self.look, openness, size));
    }
}

/// AppKit exposes the Dock tile's size but not its absolute screen frame.
/// Aim from the screen edge reserved for the Dock, or the bottom of the primary
/// display while the Dock is hidden.
fn dock_direction(mtm: MainThreadMarker, cursor: NSPoint) -> [f64; 2] {
    let screens = NSScreen::screens(mtm);
    let mut dock = None;
    let mut largest_inset = 0.0;
    for screen in &*screens {
        let frame = screen.frame();
        let visible = screen.visibleFrame();
        let left = visible.origin.x - frame.origin.x;
        let bottom = visible.origin.y - frame.origin.y;
        let right = frame.origin.x + frame.size.width - visible.origin.x - visible.size.width;
        let center_x = frame.origin.x + frame.size.width / 2.0;
        let center_y = frame.origin.y + frame.size.height / 2.0;
        for (inset, x, y) in [
            (left, frame.origin.x + left / 2.0, center_y),
            (bottom, center_x, frame.origin.y + bottom / 2.0),
            (
                right,
                frame.origin.x + frame.size.width - right / 2.0,
                center_y,
            ),
        ] {
            if inset > largest_inset {
                largest_inset = inset;
                dock = Some((frame, x, y));
            }
        }
    }
    let dock = dock.or_else(|| {
        let frame = screens.firstObject()?.frame();
        Some((
            frame,
            frame.origin.x + frame.size.width / 2.0,
            frame.origin.y + 32.0,
        ))
    });
    let Some((frame, x, y)) = dock else {
        return [0.0; 2];
    };
    let reach = (frame.size.width.min(frame.size.height) * 0.43).max(160.0);
    let x = (cursor.x - x) / reach;
    let y = (cursor.y - y) / reach;
    let distance = x.hypot(y);
    let weight = if distance > 0.0 {
        distance.tanh() / distance
    } else {
        1.0
    };
    [x * weight, y * weight]
}
