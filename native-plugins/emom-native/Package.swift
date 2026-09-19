// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MusclemaxEmomNative",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "MusclemaxEmomNative",
            targets: ["EmomNativePlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "EmomNativePlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/EmomNativePlugin",
            resources: [.process("Resources")]
        )
    ]
)
