import { useRef } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
// @ts-ignore - html2canvas types may not be available
import html2canvas from 'html2canvas';

interface ChartSpec {
  chartType: 'bar' | 'pie' | 'line' | 'radar' | 'scatter';
  title: string;
  description: string;
  data: Array<{ name: string; value: number; [key: string]: any }>;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
}

interface DynamicChartProps {
  spec: ChartSpec;
  prompt: string;
  onDelete?: () => void;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export const DynamicChart = ({ spec, prompt, onDelete }: DynamicChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${spec.title.replace(/[^a-z0-9]/gi, '_')}.png`;
      link.href = url;
      link.click();
    } catch (error) {
      console.error('Failed to download chart:', error);
    }
  };

  const colors = spec.colors || DEFAULT_COLORS;

  const renderChart = () => {
    switch (spec.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={{ value: spec.xAxisLabel, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: spec.yAxisLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill={colors[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={spec.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {spec.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={{ value: spec.xAxisLabel, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: spec.yAxisLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={spec.data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" />
              <PolarRadiusAxis />
              <Radar name="Value" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.6} />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        // Scatter chart expects data with x and y properties
        const scatterData = spec.data.map(item => ({
          x: item.x ?? item.value ?? 0,
          y: item.y ?? item.value ?? 0,
          name: item.name,
        }));
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" name={spec.xAxisLabel || 'X'} type="number" />
              <YAxis dataKey="y" name={spec.yAxisLabel || 'Y'} type="number" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Data" data={scatterData} fill={colors[0]} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type: {spec.chartType}</div>;
    }
  };

  return (
    <Card className="p-6" ref={chartRef}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-xs text-text-muted mb-2">
            Prompt: "{prompt}"
          </p>
          <h3 className="text-xl font-serif font-semibold text-text-primary">
            {spec.title}
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            Download PNG
          </Button>
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              ×
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        {renderChart()}
      </div>

      <p className="text-sm italic text-text-secondary mt-4">
        {spec.description}
      </p>
    </Card>
  );
};
