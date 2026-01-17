"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/workflow/workflow-canvas"
import { ToolsMenu } from "@/components/tools-menu"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [gridOpacity, setGridOpacity] = useState(1)
  const [initialZoom, setInitialZoom] = useState<number | null>(null)
  const canvasRef = useRef<WorkflowCanvasHandle>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  const handleZoomChange = useCallback(
    (zoom: number) => {
      if (initialZoom === null) {
        setInitialZoom(zoom)
        return
      }

      const zoomRatio = zoom / initialZoom

      if (zoomRatio > 1) {
        const opacity = Math.max(0, 1 - (zoomRatio - 1) * 2)
        setGridOpacity(opacity)
      } else {
        const targetOpacity = Math.min(1, 1 - (1 - zoomRatio) * 0.5)
        setGridOpacity(targetOpacity)
      }
    },
    [initialZoom],
  )

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary to-muted" />
      <div className="absolute inset-0 bg-grid-plus transition-opacity duration-150" style={{ opacity: gridOpacity }} />

      <main className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-4 left-[20px] right-4 z-10 flex items-center justify-between">
          {/* Logo pill */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 -m-4 rounded-full bg-glow/40 blur-xl" />
            <div
              className="relative flex flex-shrink-0 items-center gap-2 border border-muted-foreground/20 bg-neutral-900 bg-clip-padding text-primary-foreground backdrop-blur-md rounded-full px-4 py-1.5 shadow-lg"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            >
              <svg
                width="45"
                height="16"
                viewBox="0 0 1347 442"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path
                  d="M1.78814e-06 433.8V238.2V121.8H55.2L51.6 219H62.4C67.6 195.4 74.6 176 83.4 160.8C92.6 145.2 103.6 133.6 116.4 126C129.6 118 144.8 114 162 114C181.2 114 197 118.6 209.4 127.8C222.2 137 231.8 149.4 238.2 165C245 180.6 248.6 198.2 249 217.8H258.6C263.8 195 271 176 280.2 160.8C289.8 145.2 301.6 133.6 315.6 126C329.6 118 345.2 114 362.4 114C378.8 114 393.2 117.4 405.6 124.2C418 130.6 428.4 140.2 436.8 153C445.2 165.8 451.4 181.8 455.4 201C459.8 219.8 462 241.6 462 266.4V433.8H396.6V274.8C396.6 251.6 394.6 232.4 390.6 217.2C386.6 202 380.4 190.6 372 183C363.6 175.4 353 171.6 340.2 171.6C325.8 171.6 313 176.6 301.8 186.6C291 196.2 282.2 209.6 275.4 226.8C268.6 244 264.4 263.8 262.8 286.2V433.8H198.6V279C198.6 255 196.6 235.2 192.6 219.6C188.6 203.6 182.4 191.6 174 183.6C165.6 175.6 155 171.6 142.2 171.6C127 171.6 113.8 176.8 102.6 187.2C91.8 197.2 83.2 211 76.8 228.6C70.4 246.2 66.4 266 64.8 288V433.8H1.78814e-06ZM653.466 441.6C623.466 441.6 596.866 435.2 573.666 422.4C550.466 409.6 532.266 391 519.066 366.6C506.266 342.2 499.866 312.2 499.866 276.6C499.866 240.2 506.666 210 520.266 186C533.866 162 552.066 144 574.866 132C598.066 120 624.066 114 652.866 114C682.466 114 708.866 120.2 732.066 132.6C755.266 145 773.466 163.4 786.666 187.8C800.266 212.2 807.066 242.6 807.066 279C807.066 315 800.266 345.2 786.666 369.6C773.466 393.6 755.266 411.6 732.066 423.6C708.866 435.6 682.666 441.6 653.466 441.6ZM655.866 390C673.866 390 689.266 385.8 702.066 377.4C714.866 369 724.666 356.6 731.466 340.2C738.266 323.8 741.666 304.2 741.666 281.4C741.666 257.8 738.066 237.6 730.866 220.8C723.666 203.6 713.266 190.4 699.666 181.2C686.466 172 670.266 167.4 651.066 167.4C633.866 167.4 618.666 171.6 605.466 180C592.666 188 582.866 200.2 576.066 216.6C569.266 232.6 565.866 252.2 565.866 275.4C565.866 311.8 573.866 340 589.866 360C605.866 380 627.866 390 655.866 390ZM952.575 440.4C921.775 440.4 898.775 432 883.575 415.2C868.775 398.4 861.375 372.6 861.375 337.8V175.2H815.175L816.375 121.8H846.375C856.775 121.8 864.575 120.2 869.775 117C874.975 113.4 878.175 107.2 879.375 98.4L885.375 52.2H924.375V121.8H1010.18V176.4H924.375V336C924.375 351.6 927.975 362.8 935.175 369.6C942.375 376.4 952.975 379.8 966.975 379.8C974.575 379.8 982.175 379 989.775 377.4C997.775 375.4 1005.38 371.8 1012.58 366.6V429.6C1000.58 433.6 989.575 436.4 979.575 438C969.575 439.6 960.575 440.4 952.575 440.4ZM1047.3 433.8V121.8H1112.1V433.8H1047.3ZM1079.7 69.6C1065.7 69.6 1055.1 66.8 1047.9 61.2C1040.7 55.2 1037.1 46.4 1037.1 34.8C1037.1 23.6 1040.7 15 1047.9 9.00005C1055.1 3.00003 1065.7 1.90735e-05 1079.7 1.90735e-05C1094.1 1.90735e-05 1104.9 3.00003 1112.1 9.00005C1119.3 15 1122.9 23.6 1122.9 34.8C1122.9 46.4 1119.3 55.2 1112.1 61.2C1104.9 66.8 1094.1 69.6 1079.7 69.6ZM1197.18 433.8V220.8H1143.18V170.4L1222.98 174.6V163.8C1211.78 160.2 1202.38 155 1194.78 148.2C1187.58 141 1181.98 132.8 1177.98 123.6C1174.38 114 1172.58 103.8 1172.58 93C1172.58 76.2 1176.58 61.6 1184.58 49.2C1192.58 36.4 1203.78 26.6 1218.18 19.8C1232.98 12.6 1250.18 9.00005 1269.78 9.00005C1286.18 9.00005 1300.98 11.2 1314.18 15.6C1327.38 19.6 1338.18 25 1346.58 31.8L1340.58 91.8C1332.18 85 1322.38 79.4 1311.18 75C1299.98 70.6 1288.98 68.4 1278.18 68.4C1265.38 68.4 1254.78 72.4 1246.38 80.4C1238.38 88 1234.38 100 1234.38 116.4C1234.38 126.4 1235.98 134.8 1239.18 141.6C1242.38 148.4 1246.58 154 1251.78 158.4C1256.98 162.4 1262.18 165.6 1267.38 168H1342.38V220.8H1260.78V433.8H1197.18Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ToolsMenu />
            <a
              href="https://github.com/WebRenew/motif"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary border border-muted-foreground/20 backdrop-blur-md hover:bg-primary/80 transition-colors"
              style={{ boxShadow: "inset 0 2px 8px rgba(168, 85, 247, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
              aria-label="View on GitHub"
            >
              <img src="/social-icons/github-mark.svg" alt="GitHub" className="w-4 h-4 invert" />
            </a>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        )}

        <div className={`w-full h-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}>
          <WorkflowCanvas ref={canvasRef} onZoomChange={handleZoomChange} />
        </div>
      </main>
    </div>
  )
}
