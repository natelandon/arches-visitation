import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
// @ts-ignore
import * as THREE from 'three'

interface MonthlyRank3DProps {
  data: Array<{ date: string; visitors: number }>
  year: number
  highlightMonth: number
}

interface MonthRank {
  month: number
  monthLabel: string
  visitors: number
  rank: number
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const HEIGHT_SCALE = {
  min: 1,
  max: 9
}

const ANIMATION_DURATION_MS = 650

const BAR_STYLES = {
  baseColor: '#94a3b8',
  highlightColor: '#f97316',
  width: 0.95,
  depth: 0.95
}

const COLOR_SCALE = d3.scaleLinear<string>()
  .domain([1, 12])
  .range(['#f59e0b', '#3b82f6'])

const buildMonthRanks = (data: Array<{ date: string; visitors: number }>): MonthRank[] => {
  const byMonth = new Map<number, number>()
  data.forEach(record => {
    const month = new Date(record.date).getMonth() + 1
    byMonth.set(month, record.visitors)
  })

  const months = Array.from({ length: 12 }, (_, i) => i + 1).map(month => ({
    month,
    monthLabel: MONTH_LABELS[month - 1],
    visitors: byMonth.get(month) ?? 0
  }))

  const ranked = [...months].sort((a, b) => b.visitors - a.visitors)
  const rankMap = new Map<number, number>()
  ranked.forEach((item, index) => {
    rankMap.set(item.month, index + 1)
  })

  return months.map(item => ({
    ...item,
    rank: rankMap.get(item.month) ?? 12
  }))
}


export default function MonthlyRank3D({ data, year, highlightMonth }: MonthlyRank3DProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  const monthRanks = useMemo(() => buildMonthRanks(data), [data])

  useEffect(() => {
    if (!containerRef.current || monthRanks.length === 0) return

    const container = containerRef.current
    const { clientWidth } = container
    const width = Math.max(clientWidth, 420)
    const height = 420

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1220')

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 140)
    camera.position.set(0, 5, 24)
    camera.lookAt(0, 3.5, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9)
    directionalLight.position.set(9, 13, 12)
    scene.add(directionalLight)

    const rimLight = new THREE.DirectionalLight(0x94a3b8, 0.28)
    rimLight.position.set(-9, 11, -12)
    scene.add(rimLight)

    const floorGeometry = new THREE.PlaneGeometry(26, 12)
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#0f172a', opacity: 0.3, transparent: true })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.01
    scene.add(floor)

    const gridHelper = new THREE.GridHelper(26, 12, 0x1f2937, 0x1f2937)
    gridHelper.material.opacity = 0.2
    gridHelper.material.transparent = true
    gridHelper.position.y = 0
    scene.add(gridHelper)

    const heightScale = d3.scaleLinear()
      .domain([12, 1])
      .range([HEIGHT_SCALE.min, HEIGHT_SCALE.max])

    const barGroup = new THREE.Group()
    const spacing = 1.55
    const totalWidth = (monthRanks.length - 1) * spacing
    const bars: Array<{ mesh: THREE.Mesh; height: number }> = []

    monthRanks.forEach((item, index) => {
      const barHeight = heightScale(item.rank)
      const isHighlight = item.month === highlightMonth
      const geometry = new THREE.BoxGeometry(BAR_STYLES.width, barHeight, BAR_STYLES.depth)
      const material = new THREE.MeshStandardMaterial({
        color: isHighlight ? BAR_STYLES.highlightColor : BAR_STYLES.baseColor,
        metalness: 0.25,
        roughness: 0.6,
        emissive: new THREE.Color('#0f172a'),
        emissiveIntensity: 0.08
      })
      const mesh = new THREE.Mesh(geometry, material)

      mesh.position.set(index * spacing - totalWidth / 2, barHeight / 2, 0)
      mesh.scale.y = 0.001
      barGroup.add(mesh)
      bars.push({ mesh, height: barHeight })
    })

    barGroup.rotation.y = 0.35
    barGroup.rotation.x = -0.12

    scene.add(barGroup)

    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / ANIMATION_DURATION_MS, 1)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress

      bars.forEach(({ mesh, height }) => {
        const scale = Math.max(eased, 0.001)
        mesh.scale.y = scale
        mesh.position.y = (height * scale) / 2
      })

      renderer.render(scene, camera)
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)

    const handleResize = () => {
      if (!containerRef.current) return
      const nextWidth = Math.max(containerRef.current.clientWidth, 420)
      camera.aspect = nextWidth / height
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, height)
      renderer.render(scene, camera)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      barGroup.clear()
      floorGeometry.dispose()
      floorMaterial.dispose()
      gridHelper.geometry.dispose()
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach((material: THREE.Material) => material.dispose())
      } else {
        gridHelper.material.dispose()
      }
      renderer.dispose()
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
    }
  }, [monthRanks, highlightMonth])

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="w-full min-h-[420px] rounded-lg border border-border bg-gradient-to-br from-slate-950/60 via-slate-950/20 to-slate-900/10"
        role="img"
        aria-label={`3D bar chart of ${year} monthly visitation ranks. Taller bars indicate busier months. Highlighted month is ${MONTH_LABELS[highlightMonth - 1]}.`}
      />
      <div className="grid grid-cols-6 gap-2 text-xs text-muted-foreground sm:grid-cols-12">
        {monthRanks.map(item => (
          <div
            key={item.month}
            className={`flex flex-col items-center rounded-md p-2 transition-colors ${
              item.month === highlightMonth
                ? 'bg-orange-500/20 text-orange-400'
                : 'hover:bg-slate-800/50'
            }`}
          >
            <span className="font-medium text-foreground">{item.monthLabel}</span>
            <span>#{item.rank}</span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {monthRanks.map(item => (
          <li key={item.month}>{item.monthLabel}: rank {item.rank}</li>
        ))}
      </ul>
    </div>
  )
}
